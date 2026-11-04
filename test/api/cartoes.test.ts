import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criaAmbiente, reqAdmin } from "./ambiente.ts";

type Amb = Awaited<ReturnType<typeof criaAmbiente>>;
let amb: Amb;
beforeEach(async () => { amb = await criaAmbiente(); });
afterEach(() => amb.fecha());

const chama = async (metodo: string, caminho: string, corpo?: unknown) => {
  const r = await amb.chamar(await reqAdmin(metodo, caminho, corpo));
  return { status: r.status, corpo: await r.json() };
};
const cartoes = async () => (await chama("GET", "/api/admin/estado")).corpo.cartoes as { id: number; titulo: string; ativo: boolean }[];
const nPublicacoes = async () => (await amb.env.DB.prepare("SELECT COUNT(*) n FROM publicacoes").first<{ n: number }>())!.n;
const novo = (titulo: string) => ({ titulo, destaque: "", descricao: "Descrição de " + titulo });

describe("cartões", () => {
  it("cria no fim, reordena e cada mudança publica", async () => {
    const a = await chama("POST", "/api/admin/cartoes", novo("Karaokê"));
    const b = await chama("POST", "/api/admin/cartoes", novo("Telão"));
    expect(a.status).toBe(200);
    expect([a.corpo.cartao.ordem, b.corpo.cartao.ordem]).toEqual([1, 2]);
    await chama("PUT", "/api/admin/cartoes/ordem", { ids: [b.corpo.cartao.id, a.corpo.cartao.id] });
    expect((await cartoes()).map((c) => c.titulo)).toEqual(["Telão", "Karaokê"]);
    expect(await nPublicacoes()).toBe(3);
  });

  it("ordem com ids faltando ou sobrando: 400", async () => {
    const a = await chama("POST", "/api/admin/cartoes", novo("Karaokê"));
    await chama("POST", "/api/admin/cartoes", novo("Telão"));
    for (const ids of [[a.corpo.cartao.id], [a.corpo.cartao.id, 999], [a.corpo.cartao.id, a.corpo.cartao.id]]) {
      const r = await chama("PUT", "/api/admin/cartoes/ordem", { ids });
      expect(r.status).toBe(400);
      expect(r.corpo.erro).toBe("A lista de cartões mudou. Recarregue a página.");
    }
  });

  it("editar, desligar e apagar", async () => {
    const { corpo } = await chama("POST", "/api/admin/cartoes", novo("Karaokê"));
    const id = corpo.cartao.id;
    expect((await chama("PUT", `/api/admin/cartoes/${id}`, { ...novo("Karaokê novo"), ativo: false })).status).toBe(200);
    expect(await cartoes()).toMatchObject([{ id, titulo: "Karaokê novo", ativo: false }]);
    expect((await chama("DELETE", `/api/admin/cartoes/${id}`)).status).toBe(200);
    expect(await cartoes()).toEqual([]);
  });

  it("cartão inexistente: 404; inválido: 400", async () => {
    expect((await chama("PUT", "/api/admin/cartoes/99", novo("X"))).status).toBe(404);
    expect((await chama("DELETE", "/api/admin/cartoes/99")).status).toBe(404);
    expect((await chama("POST", "/api/admin/cartoes", { titulo: "" })).status).toBe(400);
  });

  it("foto que não está no R2: 400; enviada: grava", async () => {
    expect((await chama("POST", "/api/admin/cartoes", { ...novo("Telão"), fotoChave: "fotos/nao.webp" })).status).toBe(400);
    await amb.env.ARQUIVOS.put("fotos/sim.webp", "RIFF0000WEBP");
    const r = await chama("POST", "/api/admin/cartoes", { ...novo("Telão"), fotoChave: "fotos/sim.webp" });
    expect(r.corpo.cartao.fotoChave).toBe("fotos/sim.webp");
  });
});

describe("pacotes", () => {
  beforeEach(async () => {
    await amb.env.DB.prepare("INSERT INTO pacotes (chave, nome, chegou_em, musicas, visto_em) VALUES ('13K', '13K', '2020-01-01', 30, '2026-11-04'), ('ARI EXCLUSIVO', 'ARI EXCLUSIVO', '2020-01-01', 5, '2026-11-04')").run();
  });
  it("classificação manual vence a automática", async () => {
    const r = await chama("PUT", "/api/admin/pacotes/13K", { modo: "exc" });
    expect(r.status).toBe(200);
    const p = (await chama("GET", "/api/admin/estado")).corpo.pacotes.find((x: { chave: string }) => x.chave === "13K");
    expect(p).toMatchObject({ modo: "exc", classe: "exc" });
  });
  it("chave com espaço na URL", async () => {
    expect((await chama("PUT", "/api/admin/pacotes/ARI%20EXCLUSIVO", { modo: "nova" })).status).toBe(200);
  });
  it("modo inválido: 400; pacote inexistente: 404", async () => {
    expect((await chama("PUT", "/api/admin/pacotes/13K", { modo: "x" })).status).toBe(400);
    expect((await chama("PUT", "/api/admin/pacotes/NAO", { modo: "nova" })).status).toBe(404);
  });
});
