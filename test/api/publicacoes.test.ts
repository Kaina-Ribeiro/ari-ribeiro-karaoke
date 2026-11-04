import { afterEach, describe, expect, it } from "vitest";
import { musicasNoAr, ultimaPublicacao } from "../../api/publicacoes.ts";
import type { Deps } from "../../api/tipos.ts";
import { criaAmbiente, reqAdmin, reqBuild } from "./ambiente.ts";

type Amb = Awaited<ReturnType<typeof criaAmbiente>>;
let amb: Amb | undefined;
afterEach(async () => { await amb?.fecha(); amb = undefined; });

/** fetch falso que registra o que a API mandou pro GitHub. */
function githubFalso(status: number) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    pedidos.push({ url: String(url), init });
    return new Response(null, { status });
  }) as unknown as Deps["fetch"];
  return { pedidos, fetch };
}

const publicar = async (a: Amb, deps?: Partial<Deps>) => {
  const r = await a.chamar(await reqAdmin("POST", "/api/admin/publicar", { motivo: "tentar-de-novo" }), deps);
  return { status: r.status, corpo: await r.json() };
};
const status = async (a: Amb, corpo: unknown) => {
  const r = await a.chamar(reqBuild("POST", "/api/build/status", corpo));
  return { status: r.status, corpo: await r.json() };
};

describe("pedir publicação", () => {
  it("sem token do GitHub (dev): fica ok, simulado", async () => {
    amb = await criaAmbiente();
    const r = await publicar(amb);
    expect(r.status).toBe(200);
    expect(r.corpo.publicacao).toMatchObject({ status: "ok", erro: "simulado em dev", motivo: "tentar-de-novo" });
  });

  it("com token: dispara o repository_dispatch e fica pendente", async () => {
    amb = await criaAmbiente({ env: { GH_DISPATCH_TOKEN: "gh-teste" } });
    const gh = githubFalso(204);
    const r = await publicar(amb, { fetch: gh.fetch });
    expect(r.corpo.publicacao.status).toBe("pendente");
    expect(gh.pedidos).toHaveLength(1);
    expect(gh.pedidos[0].url).toBe("https://api.github.com/repos/Kaina-Ribeiro/ari-ribeiro-karaoke/dispatches");
    const h = new Headers(gh.pedidos[0].init.headers);
    expect(h.get("Authorization")).toBe("Bearer gh-teste");
    expect(JSON.parse(String(gh.pedidos[0].init.body))).toEqual({ event_type: "publicar", client_payload: { publicacao: r.corpo.publicacao.id } });
  });

  it("GitHub recusa: falhou com o motivo", async () => {
    amb = await criaAmbiente({ env: { GH_DISPATCH_TOKEN: "gh-teste" } });
    const r = await publicar(amb, { fetch: githubFalso(401).fetch });
    expect(r.corpo.publicacao.status).toBe("falhou");
    expect(r.corpo.publicacao.erro).toContain("HTTP 401");
  });

  it("GitHub fora do ar: falhou sem derrubar a API", async () => {
    amb = await criaAmbiente({ env: { GH_DISPATCH_TOKEN: "gh-teste" } });
    const fetch = (async () => { throw new TypeError("fetch failed"); }) as unknown as Deps["fetch"];
    const r = await publicar(amb, { fetch });
    expect(r.status).toBe(200);
    expect(r.corpo.publicacao.status).toBe("falhou");
  });
});

describe("status vindo do build", () => {
  it("sem publicação (checagem diária) cria uma e devolve o id", async () => {
    amb = await criaAmbiente();
    const r = await status(amb, { status: "rodando", runUrl: "https://github.com/x/y/actions/runs/1" });
    expect(r.status).toBe(200);
    const p = await ultimaPublicacao(amb.env);
    expect(p).toMatchObject({ id: r.corpo.publicacao, motivo: "diaria", status: "rodando", runUrl: "https://github.com/x/y/actions/runs/1" });
  });

  it("ok numa mais nova encerra as anteriores; uma antiga atrasada não volta atrás", async () => {
    amb = await criaAmbiente({ env: { GH_DISPATCH_TOKEN: "gh-teste" } });
    const gh = githubFalso(204);
    const p1 = (await publicar(amb, { fetch: gh.fetch })).corpo.publicacao.id;
    const p2 = (await publicar(amb, { fetch: gh.fetch })).corpo.publicacao.id;
    await status(amb, { publicacao: p2, status: "ok", musicas: 100 });
    const atrasada = await status(amb, { publicacao: p1, status: "falhou", erro: "cancelada" });
    expect(atrasada.corpo).toEqual({ publicacao: p1, ignorada: true });
    const { results } = await amb.env.DB.prepare("SELECT id, status FROM publicacoes ORDER BY id").all();
    expect(results).toEqual([{ id: p1, status: "ok" }, { id: p2, status: "ok" }]);
    expect((await ultimaPublicacao(amb.env))?.status).toBe("ok");
  });

  it("guarda quantas músicas estão no ar", async () => {
    amb = await criaAmbiente();
    expect(await musicasNoAr(amb.env)).toBeNull();
    const { corpo } = await status(amb, { status: "rodando" });
    await status(amb, { publicacao: corpo.publicacao, status: "ok", musicas: 12000 });
    expect(await musicasNoAr(amb.env)).toBe(12000);
  });

  it("falhou guarda o erro", async () => {
    amb = await criaAmbiente();
    const { corpo } = await status(amb, { status: "rodando" });
    await status(amb, { publicacao: corpo.publicacao, status: "falhou", erro: "x".repeat(900) });
    const p = await ultimaPublicacao(amb.env);
    expect(p?.status).toBe("falhou");
    expect(p?.erro).toHaveLength(500);
    expect(p?.terminouEm).toBeTruthy();
  });

  it("uma publicação antiga terminando ok não gasta o 'forçar' do arquivo confirmado", async () => {
    // A (banner) roda sem o forçar; o Ari confirma um catálogo menor (B, com forçar) logo depois.
    // Se A apagasse o forçar, B e todo "Tentar de novo" falhariam na trava de 50%.
    amb = await criaAmbiente();
    const { corpo: a } = await status(amb, { status: "rodando" });
    const cat = { fonte: "arquivo", link: null, arquivo: { chave: "planilhas/a.xlsx", nome: "a.xlsx", enviadoEm: "x", musicas: 10, pacotes: 1, forcar: true } };
    await amb.env.DB.prepare("INSERT INTO config VALUES ('catalogo', ?, 'x')").bind(JSON.stringify(cat)).run();
    await status(amb, { publicacao: a.publicacao, status: "ok", musicas: 1000 });
    const row = await amb.env.DB.prepare("SELECT valor FROM config WHERE chave = 'catalogo'").first<{ valor: string }>();
    expect(JSON.parse(row!.valor).arquivo.forcar).toBe(true);
  });

  it("status desconhecido ou publicação inexistente", async () => {
    amb = await criaAmbiente();
    expect((await status(amb, { status: "xyz" })).status).toBe(400);
    expect((await status(amb, { publicacao: 999, status: "ok" })).status).toBe(404);
  });
});
