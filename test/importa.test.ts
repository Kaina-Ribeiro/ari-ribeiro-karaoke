import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dadosImportacao, sqlImportacao } from "../scripts/importa-sql.ts";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";
import { comoObjetos } from "../src/lib/planilha.ts";
import { criaAmbiente, reqAdmin } from "./api/ambiente.ts";

type Amb = Awaited<ReturnType<typeof criaAmbiente>>;
let amb: Amb;
beforeEach(async () => { amb = await criaAmbiente(); });
afterEach(() => amb.fecha());

const produtos = comoObjetos([
  ["ativo", "titulo", "destaque", "descricao"],
  ["S", "Contato para locação", "12991167274", ""],
  ["S", "Aluguel de Karaoke", "Pacotes especiais", "alugue para o final de semana"],
  ["S", "Ari's Fotos", "Fotografo", "Ensaios; fotos 'em geral'"],
  ["N", "Desligado", "x", "não entra"],
]);
const musicas = comoObjetos([
  ["codigo", "titulo", "pacote"],
  ["1", "a", "13K"], ["2", "b", "13k "], ["3", "c", "Ari Ribeiro karaoke"], ["4", "d", ""],
]);
const roda = async (sql: string[]) => { for (const s of sql) await amb.env.DB.prepare(s).run(); };
const estado = async () => (await amb.chamar(await reqAdmin("GET", "/api/admin/estado"))).json();

describe("dadosImportacao", () => {
  it("contato da linha 'Contato para locação', cartões sem ela e só os ativos", () => {
    const d = dadosImportacao(produtos, musicas, "2026-11-04");
    expect(d.contato).toEqual({ ...CONFIG_PADRAO.contato, zapContato: "5512991167274" });
    expect(d.cartoes.map((c) => c.titulo)).toEqual(["Aluguel de Karaoke", "Ari's Fotos"]);
    expect(d.pacotes).toEqual([{ nome: "13K", musicas: 2 }, { nome: "Ari Ribeiro karaoke", musicas: 1 }]);
    expect(d.banner).toEqual(CONFIG_PADRAO.banner);
    expect(d.catalogo).toEqual(CONFIG_PADRAO.catalogo);
  });
});

describe("sqlImportacao", () => {
  it("grava o site de hoje: contato, cartões, pacotes automáticos com chegada na data da importação", async () => {
    await roda(sqlImportacao(dadosImportacao(produtos, musicas, "2026-11-04")));
    const e = await estado();
    expect(e.contato.zapContato).toBe("5512991167274");
    expect(e.catalogo.fonte).toBe("link");
    expect(e.cartoes.map((c: { titulo: string; descricao: string }) => [c.titulo, c.descricao])).toEqual([
      ["Aluguel de Karaoke", "alugue para o final de semana"],
      ["Ari's Fotos", "Ensaios; fotos 'em geral'"],
    ]);
    expect(e.pacotes.every((p: { modo: string; chegouEm: string }) => p.modo === "auto" && p.chegouEm === "2026-11-04")).toBe(true);
  });

  it("rodar duas vezes não duplica nem apaga o que o Ari mudou", async () => {
    const sql = sqlImportacao(dadosImportacao(produtos, musicas, "2026-11-04"));
    await roda(sql);
    await amb.chamar(await reqAdmin("PUT", "/api/admin/contato", { zapContato: "12988887777", instagram: "ari" }));
    await roda(sqlImportacao(dadosImportacao(produtos, musicas, "2026-12-01")));
    const e = await estado();
    expect(e.cartoes).toHaveLength(2);
    expect(e.pacotes).toHaveLength(2);
    expect(e.pacotes[0].chegouEm).toBe("2026-11-04");
    expect(e.contato.zapContato).toBe("5512988887777");
  });
});
