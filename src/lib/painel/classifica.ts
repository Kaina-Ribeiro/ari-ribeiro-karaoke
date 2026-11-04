import type { Pacote } from "../texto.ts";
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
 * Novidade é o pacote que chegou há menos de `prazoDias`. A escolha manual do Ari vence tudo;
 * o catálogo base e os exclusivos seguem a regra de sempre.
 */
export function classifica(p: { nome: string; chegouEm: string; modo: Modo }, prazoDias: number, hoje: string): Pacote {
  if (p.modo !== "auto") return p.modo;
  const chave = chavePacote(p.nome);
  if (chave === "" || chave === "ARI RIBEIRO KARAOKE") return "base";
  if (chave.includes("EXCLUSIVO")) return "exc";
  return diasEntre(p.chegouEm, hoje) < prazoDias ? "nova" : "base";
}
