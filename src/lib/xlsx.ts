/**
 * Lê o catálogo de um .xlsx com o SheetJS. Roda no navegador (prévia no painel) e no build;
 * nunca no Worker, que não tem CPU pra isso.
 */
import * as XLSX from "xlsx";
import { chavePacote } from "./painel/classifica.ts";
import { comoObjetos, contaPacotes, montaMusicas } from "./planilha.ts";
import { normaliza } from "./texto.ts";

export class ErroPlanilha extends Error {}

/** Linhas da aba "Músicas" como objetos, com o mesmo cabeçalho normalizado do CSV do Google. */
export function lerAbaMusicas(dados: ArrayBuffer | Uint8Array): Record<string, string>[] {
  let livro: XLSX.WorkBook;
  try {
    livro = XLSX.read(dados, { type: "array" });
  } catch {
    throw new ErroPlanilha("Não consegui abrir esse arquivo. Salve como .xlsx e tente de novo.");
  }
  const nome = livro.SheetNames.find((n) => normaliza(n) === "musicas");
  if (!nome) throw new ErroPlanilha('O arquivo não tem a aba "Músicas".');
  // raw: false pega o texto como aparece na célula: o código 550 formatado como 00000 continua "00550"
  const tabela = XLSX.utils.sheet_to_json<string[]>(livro.Sheets[nome], { header: 1, raw: false, defval: "" });
  const linhas = comoObjetos(tabela.map((l) => l.map((c) => String(c))));
  const cabecalho = (tabela[0] ?? []).map((c) => normaliza(String(c)));
  if (!cabecalho.includes("codigo") || !cabecalho.includes("titulo")) throw new ErroPlanilha("A aba Músicas precisa das colunas codigo e titulo.");
  return linhas;
}

/** Trava contra arquivo errado: menos da metade das músicas que estão no ar. */
export const abaixoDaMetade = (total: number, musicasNoAr: number | null): boolean => musicasNoAr !== null && total < musicasNoAr / 2;

export interface Previa {
  musicas: number;
  pacotes: number;
  /** pacotes que o site ainda não conhece: vão entrar como Novidade */
  novos: string[];
  /** linhas sem código/título, repetidas ou marcadas como duplicado */
  ignoradas: number;
  abaixoDaMetade: boolean;
}

export function previaPlanilha(linhas: Record<string, string>[], pacotesConhecidos: string[], musicasNoAr: number | null): Previa {
  const musicas = montaMusicas(linhas).length;
  const conhecidos = new Set(pacotesConhecidos.map(chavePacote));
  const pacotes = contaPacotes(linhas).filter((p) => p.nome);
  return {
    musicas,
    pacotes: pacotes.length,
    novos: pacotes.filter((p) => !conhecidos.has(chavePacote(p.nome))).map((p) => p.nome),
    ignoradas: linhas.length - musicas,
    abaixoDaMetade: abaixoDaMetade(musicas, musicasNoAr),
  };
}
