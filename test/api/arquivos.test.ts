import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Deps } from "../../api/tipos.ts";
import { criaAmbiente, jwtDeTeste, reqAdmin, SITE } from "./ambiente.ts";

type Amb = Awaited<ReturnType<typeof criaAmbiente>>;
let amb: Amb;
beforeEach(async () => {
  amb = await criaAmbiente({ deps: { agora: () => new Date("2026-11-04T15:00:00Z"), aleatorio: () => "a1b2c3" } });
});
afterEach(() => amb.fecha());

const XLSX_MINIMO = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]);
const WEBP_MINIMO = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 ")]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function envia(tipo: string, bytes: Uint8Array<ArrayBuffer>, nome = "Catálogo do Ari.xlsx") {
  const form = new FormData();
  form.set("tipo", tipo);
  form.set("arquivo", new File([bytes], nome));
  const r = await amb.chamar(new Request(SITE + "/api/admin/arquivos", {
    method: "POST", body: form, headers: { "Cf-Access-Jwt-Assertion": await jwtDeTeste("gabriel@painel.test"), Origin: SITE },
  }));
  return { status: r.status, corpo: await r.json() };
}

describe("upload", () => {
  it("planilha: chave gerada no servidor, sem o nome do arquivo", async () => {
    const r = await envia("planilha", XLSX_MINIMO);
    expect(r).toEqual({ status: 200, corpo: { chave: "planilhas/2026-11-04-a1b2c3.xlsx" } });
    const obj = await amb.env.ARQUIVOS.get(r.corpo.chave);
    expect(new Uint8Array(await obj!.arrayBuffer())).toEqual(XLSX_MINIMO);
  });
  it("foto WebP", async () => {
    expect((await envia("foto", WEBP_MINIMO, "eu.webp")).corpo).toEqual({ chave: "fotos/a1b2c3.webp" });
  });
  it("assinatura errada: 415", async () => {
    expect((await envia("foto", PNG, "x.webp")).status).toBe(415);
    const r = await envia("planilha", PNG);
    expect(r.status).toBe(415);
    expect(r.corpo.erro).toBe("Esse arquivo não é um .xlsx.");
  });
  it("grande demais: 413", async () => {
    const foto = new Uint8Array(2 * 1024 * 1024 + 1); foto.set(WEBP_MINIMO);
    expect((await envia("foto", foto)).status).toBe(413);
    const plan = new Uint8Array(10 * 1024 * 1024 + 1); plan.set(XLSX_MINIMO);
    expect((await envia("planilha", plan)).status).toBe(413);
  });
  it("tipo desconhecido: 400", async () => {
    expect((await envia("video", WEBP_MINIMO)).status).toBe(400);
  });
});

describe("ler arquivo enviado", () => {
  it("serve do R2 com o tipo certo", async () => {
    const { corpo } = await envia("foto", WEBP_MINIMO);
    const r = await amb.chamar(await reqAdmin("GET", "/api/admin/arquivos/" + corpo.chave));
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/webp");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(WEBP_MINIMO);
  });
  it("chave fora do padrão ou inexistente: 404", async () => {
    for (const c of ["%2e%2e%2fsegredo", "outros/x.txt", "fotos/nao.webp"]) {
      expect((await amb.chamar(await reqAdmin("GET", "/api/admin/arquivos/" + c))).status).toBe(404);
    }
  });
});

describe("testar link da planilha", () => {
  const google = (status: number, corpo: string) => {
    const urls: string[] = [];
    const fetch = (async (u: string) => { urls.push(String(u)); return new Response(corpo, { status }); }) as unknown as Deps["fetch"];
    return { urls, fetch };
  };
  const testa = async (url: string, deps: Partial<Deps>) => {
    const r = await amb.chamar(await reqAdmin("GET", "/api/admin/link/teste?url=" + encodeURIComponent(url)), deps);
    return { status: r.status, corpo: await r.json() };
  };
  const LINK = "https://docs.google.com/spreadsheets/d/1abcdefghijklmnop_XYZ/edit";

  it("planilha pública com as colunas: ok, e consulta só o Google", async () => {
    const g = google(200, '"codigo","cantor","titulo"\n"1","A","B"\n');
    const r = await testa(LINK, { fetch: g.fetch });
    expect(r).toEqual({ status: 200, corpo: { ok: true, id: "1abcdefghijklmnop_XYZ" } });
    expect(g.urls[0]).toBe("https://docs.google.com/spreadsheets/d/1abcdefghijklmnop_XYZ/gviz/tq?tqx=out:csv&sheet=M%C3%BAsicas");
  });
  it("planilha fechada (página de login) ou erro: 422", async () => {
    for (const g of [google(200, "<!doctype html><html>login</html>"), google(404, "")]) {
      const r = await testa(LINK, { fetch: g.fetch });
      expect(r.status).toBe(422);
      expect(r.corpo.erro).toBe("A planilha não está pública. Abra o compartilhamento no Google.");
    }
  });
  it("link de outro site: 400 sem consultar nada", async () => {
    const g = google(200, "");
    expect((await testa("https://evil.com/spreadsheets/d/1abcdefghijklmnop_XYZ", { fetch: g.fetch })).status).toBe(400);
    expect(g.urls).toEqual([]);
  });
});
