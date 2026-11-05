import { classePeloNome, type Pacote } from "../texto.ts";
import type { Modo } from "./tipos.ts";

/** "13k " e "13K" são o mesmo pacote; "Ã" composto ou decomposto (Mac) também. */
export const chavePacote = (nome: string): string => nome.normalize("NFC").trim().replace(/\s+/g, " ").toUpperCase();

/** Data de hoje em Brasília, AAAA-MM-DD. */
export function hojeSP(agora: Date): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(ate + "T00:00:00Z") - Date.parse(de + "T00:00:00Z")) / 86_400_000);
}

/**
 * Novidade é o pacote que chegou há até `prazoDias` dias (o dia de chegada + `prazoDias`, inclusive). A escolha manual do Ari vence tudo;
 * o catálogo base e os só no Ari (ver `classePeloNome`) não dependem da data.
 */
export function classifica(p: { nome: string; chegouEm: string; modo: Modo }, prazoDias: number, hoje: string): Pacote {
  if (p.modo !== "auto") return p.modo;
  const fixa = classePeloNome(chavePacote(p.nome));
  if (fixa) return fixa;
  return diasEntre(p.chegouEm, hoje) <= prazoDias ? "nova" : "base";
}

/** Último dia em que o pacote ainda aparece como novidade (chegada + prazo), AAAA-MM-DD. */
export function novidadeAte(chegouEm: string, prazoDias: number): string {
  return new Date(Date.parse(chegouEm + "T00:00:00Z") + prazoDias * 86_400_000).toISOString().slice(0, 10);
}
