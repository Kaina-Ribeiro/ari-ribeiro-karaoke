/**
 * "Tenta aí" embaixo da busca: sugestões sorteadas do catálogo, trocando sozinhas.
 * Sempre na mesma ordem (código, cantor, música, novidade), pra quem olha saber o que cada uma é.
 */
import type { Item } from "./busca.ts";

export type TipoDica = "codigo" | "cantor" | "musica" | "nova";
/** `q` é o que vai pra busca ao tocar */
export interface Dica { tipo: TipoDica; texto: string; q: string }

/** Letras no máximo por sugestão: cabem 2 por linha no celular de 375 px. */
export const LIMITE_DICA = 18;

const curto = (s: string) => [...s].length <= LIMITE_DICA;

/** Sorteia uma de `lista` que passe no filtro e não esteja em `fora`; tenta poucas vezes e depois varre. */
function sorteia(lista: Item[], ok: (m: Item) => boolean, chave: (m: Item) => string, fora: Set<string>, sorte: () => number): Item | undefined {
  if (!lista.length) return undefined;
  for (let k = 0; k < 40; k++) {
    const m = lista[Math.floor(sorte() * lista.length) % lista.length];
    if (ok(m) && !fora.has(chave(m))) return m;
  }
  // catálogo pequeno ou sorte ruim: a primeira que serve, a partir de um ponto sorteado
  const ini = Math.floor(sorte() * lista.length) % lista.length;
  for (let k = 0; k < lista.length; k++) {
    const m = lista[(ini + k) % lista.length];
    if (ok(m) && !fora.has(chave(m))) return m;
  }
  return lista.find((m) => ok(m));
}

/**
 * Quatro sugestões: um código, um cantor, uma música e uma novidade (sem novidade no catálogo, outra música).
 * `antes` = as que estavam na tela: não repete nenhuma, quando dá.
 */
export function sorteiaDicas(itens: Item[], sorte: () => number = Math.random, antes: Dica[] = []): Dica[] {
  if (!itens.length) return [];
  const fora = new Set(antes.map((d) => d.texto));
  const out: Dica[] = [];
  const poe = (tipo: TipoDica, m: Item | undefined, campo: "codigo" | "artista" | "titulo") => {
    if (!m) return;
    out.push({ tipo, texto: m[campo], q: m[campo] });
    fora.add(m[campo]);
  };
  const novas = itens.filter((m) => m.pacote === "nova");
  poe("codigo", sorteia(itens, () => true, (m) => m.codigo, fora, sorte), "codigo");
  poe("cantor", sorteia(itens, (m) => curto(m.artista), (m) => m.artista, fora, sorte), "artista");
  poe("musica", sorteia(itens, (m) => curto(m.titulo) && m.pacote !== "nova", (m) => m.titulo, fora, sorte), "titulo");
  const nova = sorteia(novas, (m) => curto(m.titulo), (m) => m.titulo, fora, sorte);
  if (nova) poe("nova", nova, "titulo");
  else poe("musica", sorteia(itens, (m) => curto(m.titulo), (m) => m.titulo, fora, sorte), "titulo");
  return out;
}
