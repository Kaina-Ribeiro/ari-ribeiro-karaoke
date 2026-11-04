/** Remove acentos, caixa e pontuação: "CANÇÃO PRA NÃO VOLTAR" -> "cancao pra nao voltar". */
export function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[´`’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "pra", "the", "of", "and", "on", "in", "to"]);

/** A planilha guarda títulos em MAIÚSCULAS com acento agudo no lugar do apóstrofo. */
export function tituloBonito(s: string): string {
  return s
    .trim()
    .replace(/[´`]/g, "’")
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/’(\w)/g, (_, c: string) => "’" + c.toLowerCase());
}

/** Chave pra juntar o mesmo cantor escrito de jeitos diferentes: "Guns N Roses" = "Guns n´ Roses", "F.R. David" = "FR David". */
export const chaveArtista = (s: string) => normaliza(s).replace(/[^a-z0-9]/g, "");

const VOGAL = /[aeiouáéíóúâêôãõày]/i;
// sem "o" e "a": em nome de cantor costumam ser parte do nome ("Kevin O Chris")
const MINUSCULAS_NOME = new Set(["de", "da", "do", "das", "dos", "e", "os", "as", "the", "of", "and", "in", "on", "to"]);

/**
 * Arruma o apóstrofo e tira da CAIXA ALTA os nomes de várias palavras ("ALICE IN CHAINS" -> "Alice in Chains").
 * Nome de uma palavra só (BTS, CHER, ABBA) e siglas sem vogal ou com número (MC, DJ, CPM, G15) ficam como estão.
 */
export function nomeArtista(s: string): string {
  const n = s.trim().replace(/[´`]/g, "’");
  const palavras = n.split(/\s+/);
  if (n !== n.toUpperCase() || palavras.filter((w) => /\p{L}{2}/u.test(w)).length < 2) return n;
  return palavras
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i > 0 && MINUSCULAS_NOME.has(lw)) return lw;
      if (/\d/.test(w) || !VOGAL.test(w)) return w;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(" ");
}

export type Pacote = "base" | "nova" | "exc";

/** "Ari Ribeiro karaoke" é o catálogo base, "ARI EXCLUSIVO" é exclusiva, o resto (13K, INTER 14G…) são pacotes novos. */
export function tipoPacote(p: string): Pacote {
  const u = p.toUpperCase().trim();
  if (u === "" || u === "ARI RIBEIRO KARAOKE") return "base";
  if (u.includes("EXCLUSIVO")) return "exc";
  return "nova";
}

/** Letra que agrupa o artista no índice A–Z; números e símbolos vão pra "#". */
export function letraDe(artista: string): string {
  const c = normaliza(artista).charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export function escapa(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
