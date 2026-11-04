/**
 * Gera data/fixture/musicas.xlsx a partir de data/fixture/musicas.csv, pra testar o upload de planilha
 * com os mesmos dados do modo offline. Todas as células vão como texto, como no Google Sheets.
 *   node scripts/fixture-xlsx.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { lerCsv } from "../src/lib/planilha.ts";

const linhas = lerCsv(await readFile(new URL("../data/fixture/musicas.csv", import.meta.url), "utf8"));
const livro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet(linhas), "Músicas");
XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([["ativo", "titulo"], ["S", "outra aba, ignorada"]]), "Produtos");
await writeFile(new URL("../data/fixture/musicas.xlsx", import.meta.url), XLSX.write(livro, { type: "buffer", bookType: "xlsx" }));
console.log(`${linhas.length - 1} linhas em data/fixture/musicas.xlsx`);
