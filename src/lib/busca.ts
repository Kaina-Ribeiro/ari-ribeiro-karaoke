import { normaliza, type Pacote } from "./texto.ts";

export interface Item {
  i: number;            // posição no catálogo (e no array de letras)
  codigo: string;
  artista: string;
  titulo: string;
  pacote: Pacote;
  chaveTitulo: string;
  chaveArtista: string;
  palavras: string[];
}

export interface Resultado { item: Item; nota: number; pelaLetra: boolean }

export const NOTA_CODIGO_EXATO = 1000;

/** Aceita até 1 erro de digitação (troca, sobra ou falta de uma letra). */
export function quase(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, erros = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++erros > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return erros + (a.length - i) + (b.length - j) <= 1;
}

export const soDigitos = (q: string) => /^\d+$/.test(q);

/** Nota por código, título e artista. `q` já vem normalizada. 0 = não bate. */
export function notaTexto(m: Item, q: string): number {
  if (!q) return 1;
  if (soDigitos(q)) {
    if (m.codigo.replace(/^0+/, "") === q.replace(/^0+/, "")) return NOTA_CODIGO_EXATO;
    return m.codigo.startsWith(q) ? 500 : 0;
  }
  let total = 0;
  for (const p of q.split(" ")) {
    let n = 0;
    if (m.chaveTitulo.startsWith(p)) n = 60;
    else if (m.chaveArtista.startsWith(p)) n = 50;
    else if (m.palavras.includes(p)) n = 40;
    else if (m.palavras.some((w) => w.startsWith(p))) n = 30;
    else if ((m.chaveTitulo + " " + m.chaveArtista).includes(p)) n = 15;
    else if (p.length >= 4 && m.palavras.some((w) => quase(w, p) || quase(w.slice(0, p.length), p))) n = 8;
    if (!n) return 0;
    total += n;
  }
  if (m.chaveTitulo === q) total += 100;
  if (m.chaveArtista === q) total += 40;
  return total;
}

/** O começo da letra vale muito; um pedaço do meio vale menos. `letra` já vem normalizada. */
export function notaLetra(letra: string | undefined, q: string): number {
  if (!letra || q.length < 3 || soDigitos(q)) return 0;
  if (letra.startsWith(q)) return 90 + Math.min(q.length, 40);
  if (q.length >= 6 && letra.includes(q)) return 20;
  return 0;
}

export function preparaItem(i: number, codigo: string, artista: string, titulo: string, pacote: Pacote): Item {
  const chaveTitulo = normaliza(titulo);
  const chaveArtista = normaliza(artista);
  return { i, codigo, artista, titulo, pacote, chaveTitulo, chaveArtista, palavras: (chaveTitulo + " " + chaveArtista).split(" ") };
}

/** Faz a busca inteira. `letras` (normalizadas) é opcional: enquanto não carregou, busca só no resto. */
export function busca(itens: Item[], texto: string, letras?: string[], filtro: (m: Item) => boolean = () => true): Resultado[] {
  const q = normaliza(texto);
  const out: Resultado[] = [];
  for (const m of itens) {
    if (!filtro(m)) continue;
    const a = notaTexto(m, q);
    const l = q && letras ? notaLetra(letras[m.i], q) : 0;
    if (a > 0 || l > 0) out.push({ item: m, nota: Math.max(a, l), pelaLetra: l > a });
  }
  return out;
}

/** Trechos [início, fim) do texto original que batem com a busca, pra grifar. */
export function trechosQueBatem(texto: string, q: string, frase = false): [number, number][] {
  if (!q || soDigitos(q)) return [];
  let n = "";
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() || " ";
    for (const ch of c) { n += ch; mapa.push(i); }
  }
  const out: [number, number][] = [];
  for (const p of frase ? [q] : q.split(" ")) {
    if (p.length < 2) continue;
    const i = n.indexOf(p);
    if (i >= 0) out.push([mapa[i], mapa[i + p.length - 1] + 1]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.filter((r, k) => k === 0 || r[0] >= out[k - 1][1]);
}
