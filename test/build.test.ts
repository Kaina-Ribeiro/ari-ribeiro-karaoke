import { describe, expect, it } from "vitest";
import { clientePainel } from "../scripts/painel.ts";
import { confereTamanho, extensaoFoto, montaManifesto, type BaseManifesto } from "../src/lib/build.ts";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";
import type { ConfigBuild } from "../src/lib/painel/tipos.ts";

const config: ConfigBuild = {
  ...structuredClone(CONFIG_PADRAO),
  cartoes: [
    { id: 1, ordem: 1, ativo: true, titulo: "Karaokê", destaque: "Pacotes", descricao: "Alugue", fotoChave: null, zapId: null, preco: null },
    { id: 2, ordem: 2, ativo: true, titulo: "Telão", destaque: "X BOX", descricao: "Data show", fotoChave: "fotos/telao.webp", zapId: null, preco: null },
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
  it("sem KJ nem pedido escolhidos, tudo vai pro geral", () => {
    const m = montaManifesto(base, config, fotos);
    expect(m.contato).toEqual({
      zapGeral: "5512991167274", zapKj: "5512991167274", zapPedido: "5512991167274",
      rodape: [
        { rotulo: "WhatsApp - Ari", itens: [{ texto: "(12) 99116-7274", url: "https://wa.me/5512991167274", zap: true }] },
        { rotulo: "Instagram", itens: [{ texto: "@ariribeirokaraoke", url: "https://www.instagram.com/ariribeirokaraoke/" }] },
      ],
    });
  });
  it("contato antigo de produção (D1 de 05/11): mesmos números, rodapé novo só com o geral", () => {
    const antigo = { zapContato: "5512991196050", zapKj: "5512991167274", instagram: "ariribeirokaraoke", facebook: null };
    const m = montaManifesto(base, { ...config, contato: antigo as unknown as ConfigBuild["contato"] }, fotos);
    expect(m.contato).toEqual({
      zapGeral: "5512991196050", zapKj: "5512991167274", zapPedido: "5512991196050",
      rodape: [
        { rotulo: "WhatsApp - Ana Paula", itens: [{ texto: "(12) 99119-6050", url: "https://wa.me/5512991196050", zap: true }] },
        { rotulo: "Instagram", itens: [{ texto: "@ariribeirokaraoke", url: "https://www.instagram.com/ariribeirokaraoke/" }] },
      ],
    });
  });
  it("vários WhatsApp: só os ligados no rodapé, na ordem; cada destino no seu número", () => {
    const contato: ConfigBuild["contato"] = {
      zaps: [
        { id: "a", nome: "WhatsApp - Ana Paula", numero: "5512991196050", ativo: true },
        { id: "k", nome: "KJ", numero: "5512981234567", ativo: false },
        { id: "p", nome: "Pedidos", numero: "5512977776666", ativo: true },
      ],
      geral: "a", kj: "k", pedido: "p",
      redes: [
        { id: "1", rede: "youtube", usuario: "ari", ativo: true },
        { id: "2", rede: "instagram", usuario: "um", ativo: true },
        { id: "3", rede: "instagram", usuario: "dois", ativo: true },
        { id: "4", rede: "tiktok", usuario: "desligado", ativo: false },
      ],
    };
    const m = montaManifesto(base, { ...config, contato }, fotos);
    expect([m.contato.zapGeral, m.contato.zapKj, m.contato.zapPedido]).toEqual(["5512991196050", "5512981234567", "5512977776666"]);
    expect(m.contato.rodape.map((b) => [b.rotulo, b.itens.map((i) => i.url)])).toEqual([
      ["WhatsApp - Ana Paula", ["https://wa.me/5512991196050"]],
      ["Pedidos", ["https://wa.me/5512977776666"]],
      ["Instagram", ["https://www.instagram.com/um/", "https://www.instagram.com/dois/"]],
      ["YouTube", ["https://www.youtube.com/@ari"]],
    ]);
  });
  it("cartões com e sem foto; sem escolha de Zap nem preço, igual a antes", () => {
    expect(montaManifesto(base, config, fotos).servicos).toEqual([
      { titulo: "Karaokê", destaque: "Pacotes", descricao: "Alugue", foto: null, zap: "5512991167274", preco: null },
      { titulo: "Telão", destaque: "X BOX", descricao: "Data show", foto: "/img/painel/bbb.webp", zap: "5512991167274", preco: null },
    ]);
  });
  it("cada cartão vai pro seu WhatsApp: o geral, o escolhido, ou o geral se o escolhido saiu do Contato", () => {
    const contato: ConfigBuild["contato"] = {
      zaps: [
        { id: "z1", nome: "WhatsApp - Ana Paula", numero: "5512991196050", ativo: true },
        { id: "z2", nome: "WhatsApp - Ari", numero: "5512991167274", ativo: false },
      ],
      geral: "z1", kj: "z2", pedido: null, redes: [],
    };
    const cartao = config.cartoes[0];
    const preco = { texto: "a partir de R$ 350", cor: "gravata", tamanho: "g", peso: "extra" } as const;
    const cartoes = [
      { ...cartao, id: 1, titulo: "Geral", zapId: null },
      { ...cartao, id: 2, titulo: "Ari", zapId: "z2", preco },
      { ...cartao, id: 3, titulo: "Apagado", zapId: "z9" },
      // gravado antes da Fase 2: sem os campos novos
      { id: 4, ordem: 4, ativo: true, titulo: "Antigo", destaque: "", descricao: "x", fotoChave: null } as unknown as ConfigBuild["cartoes"][number],
    ];
    const s = montaManifesto(base, { ...config, contato, cartoes }, fotos).servicos;
    expect(s.map((x) => [x.titulo, x.zap, x.preco])).toEqual([
      ["Geral", "5512991196050", null],
      ["Ari", "5512991167274", preco],
      ["Apagado", "5512991196050", null],
      ["Antigo", "5512991196050", null],
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
  it("Tenta aí: tempo do painel; config antiga (sem dicas) usa o padrão de 4 s", () => {
    expect(montaManifesto(base, { ...config, dicas: { segundos: 7 } }, fotos).dicas).toEqual({ segundos: 7 });
    const { dicas: _, ...antiga } = config;
    expect(montaManifesto(base, antiga as ConfigBuild, fotos).dicas).toEqual({ segundos: 4 });
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
