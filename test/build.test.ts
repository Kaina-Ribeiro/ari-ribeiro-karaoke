import { describe, expect, it } from "vitest";
import { clientePainel } from "../scripts/painel.ts";
import { confereTamanho, extensaoFoto, montaManifesto, type BaseManifesto } from "../src/lib/build.ts";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";
import type { ConfigBuild } from "../src/lib/painel/tipos.ts";

const config: ConfigBuild = {
  ...structuredClone(CONFIG_PADRAO),
  cartoes: [
    { id: 1, ordem: 1, ativo: true, titulo: "Karaokê", destaque: "Pacotes", descricao: "Alugue", fotoChave: null },
    { id: 2, ordem: 2, ativo: true, titulo: "Telão", destaque: "X BOX", descricao: "Data show", fotoChave: "fotos/telao.webp" },
  ],
  pacotes: [],
  musicasNoAr: null,
  hoje: "2026-11-04",
};
const base: BaseManifesto = { geradoEm: "2026-11-04T12:00:00.000Z", total: 10, temLetras: true, catalogo: "/data/c.json", letras: "/data/l.json", primeiras: [] };
const fotos = new Map([["fotos/ari-cantando.webp", "/img/painel/aaa.webp"], ["fotos/telao.webp", "/img/painel/bbb.webp"]]);

describe("confereTamanho", () => {
  it("recusa menos da metade das músicas no ar, salvo se o Ari confirmou", () => {
    expect(confereTamanho(400, 1000, false)).toBe("O catálogo novo tem 400 músicas, menos da metade das 1000 que estão no ar. Confirme no painel para publicar mesmo assim.");
    expect(confereTamanho(400, 1000, true)).toBeNull();
    expect(confereTamanho(500, 1000, false)).toBeNull();
    expect(confereTamanho(10, null, false)).toBeNull();
  });
});

describe("montaManifesto", () => {
  it("sem Zap do KJ, usa o de contato", () => {
    const m = montaManifesto(base, config, fotos);
    expect(m.contato).toEqual({ zapContato: "5512991167274", zapKj: "5512991167274", zapTexto: "(12) 99116-7274", instagram: "ariribeirokaraoke", facebook: null });
  });
  it("com Zap do KJ, cada um no seu lugar", () => {
    const m = montaManifesto(base, { ...config, contato: { ...config.contato, zapKj: "5512981234567" } }, fotos);
    expect(m.contato.zapKj).toBe("5512981234567");
    expect(m.contato.zapContato).toBe("5512991167274");
  });
  it("cartões com e sem foto", () => {
    expect(montaManifesto(base, config, fotos).servicos).toEqual([
      { titulo: "Karaokê", destaque: "Pacotes", descricao: "Alugue", foto: null },
      { titulo: "Telão", destaque: "X BOX", descricao: "Data show", foto: "/img/painel/bbb.webp" },
    ]);
  });
  it("banner com a foto baixada e o rótulo pro leitor de tela", () => {
    expect(montaManifesto(base, config, fotos).banner).toEqual({
      linhas: ["Solta", "a voz,", "o palco é seu."],
      rotulo: "Solta a voz, o palco é seu",
      frase: "Acha a música, anota o *código* e manda pro KJ.",
      legenda: ["Com Ari Ribeiro", "aqui a diversão é garantida"],
      foto: { src: "/img/painel/aaa.webp", recortada: true },
    });
  });
  it("foto que não foi baixada é erro, não imagem quebrada", () => {
    expect(() => montaManifesto(base, config, new Map())).toThrow("fotos/ari-cantando.webp");
  });
});

describe("clientePainel", () => {
  it("manda o token e tenta de novo quando o servidor falha", async () => {
    const pedidos: Request[] = [];
    let n = 0;
    const f = (async (u: string, init: RequestInit) => {
      pedidos.push(new Request(u, init));
      return ++n < 3 ? new Response("x", { status: 500 }) : Response.json({ ...config });
    }) as typeof fetch;
    const c = clientePainel("http://localhost:8788/", "tok", f, async () => {});
    expect((await c.config()).hoje).toBe("2026-11-04");
    expect(pedidos).toHaveLength(3);
    expect(pedidos[0].url).toBe("http://localhost:8788/api/build/config");
    expect(pedidos[0].headers.get("Authorization")).toBe("Bearer tok");
  });
  it("erro 4xx não insiste e mostra a mensagem da API", async () => {
    let n = 0;
    const f = (async () => { n++; return Response.json({ erro: "Token do build inválido." }, { status: 401 }); }) as unknown as typeof fetch;
    await expect(clientePainel("http://x", "t", f, async () => {}).config()).rejects.toThrow("Token do build inválido.");
    expect(n).toBe(1);
  });
  it("pacotes e status mandam JSON", async () => {
    const corpos: unknown[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      corpos.push(JSON.parse(String(init.body)));
      return Response.json(corpos.length === 1 ? { classes: { "13K": "nova" } } : { publicacao: 7 });
    }) as unknown as typeof fetch;
    const c = clientePainel("http://x", "t", f, async () => {});
    expect(await c.pacotes([{ nome: "13K", musicas: 3 }])).toEqual({ "13K": "nova" });
    expect(await c.status({ status: "rodando" })).toEqual({ publicacao: 7 });
    expect(corpos).toEqual([{ pacotes: [{ nome: "13K", musicas: 3 }] }, { status: "rodando" }]);
  });
});

describe("extensaoFoto", () => {
  it("a cópia no site mantém o tipo da foto enviada", () => {
    expect(extensaoFoto("fotos/a.webp")).toBe("webp");
    expect(extensaoFoto("fotos/a.jpg")).toBe("jpg");
    expect(extensaoFoto("fotos/a.png")).toBe("png");
    expect(extensaoFoto("fotos/estranho")).toBe("webp");
  });
});
