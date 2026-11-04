import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "../../api/tipos.ts";
import { criaAmbiente, reqAdmin, reqBuild } from "./ambiente.ts";

type Amb = Awaited<ReturnType<typeof criaAmbiente>>;
let amb: Amb;
let agora = new Date("2026-11-04T15:00:00Z");
const deps: Partial<Deps> = { agora: () => agora };
beforeEach(async () => { agora = new Date("2026-11-04T15:00:00Z"); amb = await criaAmbiente({ deps }); });
afterEach(() => amb.fecha());

const build = async (metodo: string, caminho: string, corpo?: unknown) => {
  const r = await amb.chamar(reqBuild(metodo, caminho, corpo));
  return { status: r.status, corpo: r.headers.get("Content-Type")?.includes("json") ? await r.json() : await r.text() };
};
const pacotesDb = async () => (await amb.env.DB.prepare("SELECT chave, nome, chegou_em, musicas, visto_em FROM pacotes ORDER BY chave").all()).results;

describe("pacotes vistos pelo build", () => {
  it("marca a chegada só na primeira vez, juntando grafias", async () => {
    const r1 = await build("POST", "/api/build/pacotes", { pacotes: [{ nome: "13K", musicas: 30 }, { nome: "ARI EXCLUSIVO", musicas: 5 }, { nome: "", musicas: 900 }] });
    expect(r1.corpo).toEqual({ classes: { "13K": "nova", "ARI EXCLUSIVO": "exc" } });
    agora = new Date("2026-11-10T15:00:00Z");
    await build("POST", "/api/build/pacotes", { pacotes: [{ nome: "13k ", musicas: 31 }] });
    expect(await pacotesDb()).toEqual([
      { chave: "13K", nome: "13K", chegou_em: "2026-11-04", musicas: 31, visto_em: "2026-11-10" },
      { chave: "ARI EXCLUSIVO", nome: "ARI EXCLUSIVO", chegou_em: "2026-11-04", musicas: 5, visto_em: "2026-11-04" },
    ]);
  });
  it("devolve a classificação manual", async () => {
    await build("POST", "/api/build/pacotes", { pacotes: [{ nome: "13K", musicas: 30 }] });
    await amb.env.DB.prepare("UPDATE pacotes SET modo = 'base'").run();
    expect((await build("POST", "/api/build/pacotes", { pacotes: [{ nome: "13K", musicas: 30 }] })).corpo).toEqual({ classes: { "13K": "base" } });
  });
  it("corpo inválido: 400", async () => {
    expect((await build("POST", "/api/build/pacotes", { pacotes: "x" })).status).toBe(400);
  });
});

describe("config do build", () => {
  it("traz tudo, só cartões ativos e em ordem, e as músicas no ar", async () => {
    for (const [t, ativo] of [["A", true], ["B", false], ["C", true]] as const) {
      await amb.chamar(await reqAdmin("POST", "/api/admin/cartoes", { titulo: t, descricao: "d", ativo }));
    }
    const { corpo: st } = await build("POST", "/api/build/status", { status: "rodando" });
    await build("POST", "/api/build/status", { publicacao: st.publicacao, status: "ok", musicas: 1234 });
    const { status, corpo } = await build("GET", "/api/build/config");
    expect(status).toBe(200);
    expect(Object.keys(corpo).sort()).toEqual(["banner", "cartoes", "catalogo", "contato", "hoje", "musicasNoAr", "novidades", "pacotes"]);
    expect(corpo.cartoes.map((c: { titulo: string }) => c.titulo)).toEqual(["A", "C"]);
    expect(corpo.musicasNoAr).toBe(1234);
    expect(corpo.hoje).toBe("2026-11-04");
  });
  it("baixa arquivo do R2", async () => {
    await amb.env.ARQUIVOS.put("planilhas/x.xlsx", "PKconteudo");
    expect(await build("GET", "/api/build/arquivo/planilhas/x.xlsx")).toEqual({ status: 200, corpo: "PKconteudo" });
    expect((await build("GET", "/api/build/arquivo/planilhas/nao.xlsx")).status).toBe(404);
  });
});
