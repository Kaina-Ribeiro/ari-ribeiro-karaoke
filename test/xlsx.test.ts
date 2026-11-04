import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { comoObjetos, contaPacotes, lerCsv, montaMusicas } from "../src/lib/planilha.ts";
import { ErroPlanilha, lerAbaMusicas, previaPlanilha } from "../src/lib/xlsx.ts";

const fixture = async (nome: string) => readFile(new URL(`../data/fixture/${nome}`, import.meta.url));
const csv = async () => comoObjetos(lerCsv(await fixture("musicas.csv").then((b) => b.toString("utf8"))));

/** Planilha em memória com as abas dadas. */
function livro(abas: Record<string, (string | number)[][]>, ajusta?: (ws: XLSX.WorkSheet) => void): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [nome, linhas] of Object.entries(abas)) {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ajusta?.(ws);
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

describe("lerAbaMusicas", () => {
  it("o .xlsx da fixture dá as mesmas músicas que o CSV", async () => {
    const x = lerAbaMusicas(new Uint8Array(await fixture("musicas.xlsx")));
    expect(montaMusicas(x)).toEqual(montaMusicas(await csv()));
  });
  it("código salvo como número com zeros à esquerda continua com os zeros", () => {
    const b = livro({ "Músicas": [["codigo", "cantor", "titulo"], [550, "1 Kilo", "Deixe me ir"]] }, (ws) => { ws["A2"].z = "00000"; });
    expect(lerAbaMusicas(b)[0].codigo).toBe("00550");
  });
  it("acha a aba com outra grafia (MÚSICAS)", () => {
    expect(lerAbaMusicas(livro({ Produtos: [["x"]], "MÚSICAS": [["Código", "Título"], ["1", "A"]] }))).toEqual([{ codigo: "1", titulo: "A" }]);
  });
  it("sem a aba Músicas: erro claro", () => {
    expect(() => lerAbaMusicas(livro({ Planilha1: [["codigo", "titulo"]] }))).toThrow(new ErroPlanilha('O arquivo não tem a aba "Músicas".'));
  });
  it("sem as colunas codigo e titulo: erro claro", () => {
    expect(() => lerAbaMusicas(livro({ "Músicas": [["cod", "nome"], ["1", "a"]] }))).toThrow("A aba Músicas precisa das colunas codigo e titulo.");
  });
  it("arquivo que não é planilha: erro claro", () => {
    expect(() => lerAbaMusicas(new TextEncoder().encode("não sou xlsx"))).toThrow(ErroPlanilha);
  });
});

describe("contaPacotes", () => {
  it("junta grafias e conta só as linhas que entram no catálogo", () => {
    const linhas = comoObjetos([
      ["codigo", "titulo", "pacote", "duplicado"],
      ["1", "a", "13K", ""], ["2", "b", "13k ", ""], ["3", "c", "13K", ""],
      ["4", "d", "ARI EXCLUSIVO", ""], ["5", "e", "", ""], ["6", "f", "13K", "TRUE"], ["1", "repetida", "13K", ""],
    ]);
    expect(contaPacotes(linhas)).toEqual([{ nome: "13K", musicas: 3 }, { nome: "ARI EXCLUSIVO", musicas: 1 }, { nome: "", musicas: 1 }]);
  });
});

describe("previaPlanilha", () => {
  it("conta músicas, pacotes, novos e ignoradas, e avisa se for menos da metade", async () => {
    const linhas = await csv();
    const p = previaPlanilha(linhas, ["ari ribeiro karaoke"], 1000);
    expect(p.musicas).toBe(montaMusicas(linhas).length);
    expect(p.ignoradas).toBe(linhas.length - p.musicas);
    expect(p.novos).not.toContain("Ari Ribeiro karaoke");
    expect(p.novos).toContain("ARI EXCLUSIVO");
    expect(p.pacotes).toBe(contaPacotes(linhas).filter((x) => x.nome).length);
    expect(p.abaixoDaMetade).toBe(true);
    expect(previaPlanilha(linhas, [], null).abaixoDaMetade).toBe(false);
    expect(previaPlanilha(linhas, [], p.musicas * 2).abaixoDaMetade).toBe(false);
  });
});
