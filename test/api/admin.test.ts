import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_PADRAO } from "../../src/lib/painel/padrao.ts";
import { criaAmbiente, reqAdmin } from "./ambiente.ts";

type Amb = Awaited<ReturnType<typeof criaAmbiente>>;
let amb: Amb;
beforeEach(async () => { amb = await criaAmbiente({ deps: { agora: () => new Date("2026-11-04T15:00:00Z") } }); });
afterEach(() => amb.fecha());

const chama = async (metodo: string, caminho: string, corpo?: unknown) => {
  const r = await amb.chamar(await reqAdmin(metodo, caminho, corpo));
  return { status: r.status, corpo: await r.json() };
};
const estado = async () => (await chama("GET", "/api/admin/estado")).corpo;
const publicacoes = async () => (await amb.env.DB.prepare("SELECT motivo FROM publicacoes").all<{ motivo: string }>()).results.map((p) => p.motivo);
const contatoOk = { zapContato: "+55 (12) 98888-7777", zapKj: "", instagram: "@ariribeirokaraoke", facebook: "" };

describe("estado", () => {
  it("banco vazio devolve o site de hoje", async () => {
    const e = await estado();
    expect(e).toMatchObject({ ...CONFIG_PADRAO, cartoes: [], pacotes: [], publicacao: null, musicasNoAr: null, hoje: "2026-11-04" });
  });
});

describe("contato", () => {
  it("valida, grava normalizado e publica", async () => {
    const r = await chama("PUT", "/api/admin/contato", contatoOk);
    expect(r.status).toBe(200);
    expect(r.corpo.publicacao.motivo).toBe("contato");
    expect((await estado()).contato).toEqual({ zapContato: "5512988887777", zapKj: null, instagram: "ariribeirokaraoke", facebook: null });
    expect(await publicacoes()).toEqual(["contato"]);
  });
  it("inválido: 400 com a mensagem e nada publicado", async () => {
    const r = await chama("PUT", "/api/admin/contato", { ...contatoOk, zapContato: "1234" });
    expect(r.status).toBe(400);
    expect(r.corpo.erro).toBe("Zap de contato: Use um celular com DDD: (12) 99999-9999");
    expect(await publicacoes()).toEqual([]);
  });
});

describe("banner", () => {
  it("foto que não existe no R2: 400", async () => {
    const r = await chama("PUT", "/api/admin/banner", CONFIG_PADRAO.banner);
    expect(r.status).toBe(400);
    expect(r.corpo.erro).toBe("Foto não encontrada. Envie de novo.");
  });
  it("foto fora de fotos/: 400", async () => {
    await amb.env.ARQUIVOS.put("planilhas/x.xlsx", "PK");
    const r = await chama("PUT", "/api/admin/banner", { ...CONFIG_PADRAO.banner, foto: { chave: "planilhas/x.xlsx", recortada: false } });
    expect(r.status).toBe(400);
  });
  it("com foto enviada: grava e publica", async () => {
    await amb.env.ARQUIVOS.put("fotos/abc.webp", "RIFF0000WEBP");
    const banner = { ...CONFIG_PADRAO.banner, linhas: ["Canta", "", ""], foto: { chave: "fotos/abc.webp", recortada: false } };
    const r = await chama("PUT", "/api/admin/banner", banner);
    expect(r.status).toBe(200);
    expect((await estado()).banner).toEqual(banner);
  });
});

describe("catálogo", () => {
  it("link de outro site: 400", async () => {
    const r = await chama("PUT", "/api/admin/catalogo", { fonte: "link", link: "https://evil.com/x" });
    expect(r.status).toBe(400);
    expect(r.corpo.erro).toBe("Cole o link da planilha do Google (docs.google.com/spreadsheets/...).");
  });
  it("link do Google: grava normalizado", async () => {
    await chama("PUT", "/api/admin/catalogo", { fonte: "link", link: "https://docs.google.com/spreadsheets/d/1abcdefghijklmnop_XYZ/edit#gid=3" });
    expect((await estado()).catalogo).toMatchObject({ fonte: "link", link: "https://docs.google.com/spreadsheets/d/1abcdefghijklmnop_XYZ" });
  });
  it("arquivo que não está no R2: 400", async () => {
    const r = await chama("PUT", "/api/admin/catalogo", { fonte: "arquivo", arquivo: { chave: "planilhas/nao.xlsx", nome: "a.xlsx", musicas: 10, pacotes: 2 } });
    expect(r.status).toBe(400);
  });
  it("arquivo enviado: data vem do servidor, forçar só se pedido", async () => {
    await amb.env.ARQUIVOS.put("planilhas/2026-11-04-ab.xlsx", "PK");
    await chama("PUT", "/api/admin/catalogo", { fonte: "arquivo", arquivo: { chave: "planilhas/2026-11-04-ab.xlsx", nome: "Catálogo.xlsx", musicas: 10, pacotes: 2, enviadoEm: "falso" } });
    const c = (await estado()).catalogo;
    expect(c.fonte).toBe("arquivo");
    expect(c.arquivo).toEqual({ chave: "planilhas/2026-11-04-ab.xlsx", nome: "Catálogo.xlsx", enviadoEm: "2026-11-04T15:00:00.000Z", musicas: 10, pacotes: 2 });
    expect(c.link).toBe(CONFIG_PADRAO.catalogo.link); // o link continua guardado pra voltar
  });
});

describe("novidades", () => {
  it("prazo inválido: 400", async () => {
    expect((await chama("PUT", "/api/admin/novidades", { prazoDias: 0 })).status).toBe(400);
  });
  it("mudar o prazo muda a classificação", async () => {
    await amb.env.DB.prepare("INSERT INTO pacotes (chave, nome, chegou_em, musicas, visto_em) VALUES ('13K', '13K', '2026-09-20', 30, '2026-11-04')").run();
    expect((await estado()).pacotes[0]).toMatchObject({ chave: "13K", chegouEm: "2026-09-20", modo: "auto", classe: "nova" });
    await chama("PUT", "/api/admin/novidades", { prazoDias: 30 });
    expect((await estado()).pacotes[0].classe).toBe("base");
  });
});
