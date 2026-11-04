/**
 * Monta o cartaz (letreiro + pôster) a partir dos textos do banner.
 * Usado pelo site (index.astro) e pela prévia do painel, pra os dois ficarem iguais.
 */
import { escapa } from "../texto.ts";

export type Palavra = { texto: string; classe: "" | "serif" | "ouro" };

const limpa = (linhas: string[]) => linhas.map((l) => l.trim().replace(/\s+/g, " ")).filter(Boolean);

/**
 * Uma palavra por vez pra bolinha passar. Na última linha, o começo vai junto em itálico ("o palco é")
 * e a última palavra fica amarela ("seu."), como o letreiro de antes do painel.
 */
export function letreiro(linhas: string[]): Palavra[][] {
  const ls = limpa(linhas);
  return ls.map((l, i) => {
    const ps = l.split(" ");
    if (i < ls.length - 1) return ps.map((texto) => ({ texto, classe: "" as const }));
    const ultima: Palavra = { texto: ps.pop()!, classe: "ouro" };
    return ps.length ? [{ texto: ps.join(" "), classe: "serif" }, ultima] : [ultima];
  });
}

export function htmlLetreiro(linhas: string[]): string {
  return letreiro(linhas)
    .map((ps) => `<span class="l">${ps.map((p) => `<span class="${p.classe ? "w " + p.classe : "w"}">${escapa(p.texto)}</span>`).join(" ")}</span>`)
    .join("");
}

/** Texto do letreiro pro leitor de tela ("Solta a voz, o palco é seu"). */
export const rotuloLetreiro = (linhas: string[]): string => limpa(linhas).join(" ").replace(/[\s.!?…]+$/, "");

/** Duas linhas, quebrando no espaço mais perto do meio. */
export function quebraNoMeio(s: string): [string, string] {
  const t = s.trim();
  let melhor = -1;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === " " && (melhor < 0 || Math.abs(i - t.length / 2) < Math.abs(melhor - t.length / 2))) melhor = i;
  }
  return melhor < 0 ? [t, ""] : [t.slice(0, melhor), t.slice(melhor + 1)];
}

/** "anota o *código*" → trecho "código" em negrito. */
export function negrito(s: string): { texto: string; forte: boolean }[] {
  return s.split(/\*([^*]+)\*/).map((texto, i) => ({ texto, forte: i % 2 === 1 })).filter((t) => t.texto);
}

export function htmlPoster(legenda: [string, string], foto: { src: string; recortada: boolean }): string {
  const linhas = (s: string) => quebraNoMeio(s).filter(Boolean).map(escapa).join("<br />");
  const img = foto.recortada
    ? `<img src="${escapa(foto.src)}" alt="" fetchpriority="high" />`
    : `<img class="cheia" src="${escapa(foto.src)}" alt="" fetchpriority="high" />`;
  return `<div class="poster" aria-hidden="true">`
    + `<span class="fita a"></span><span class="fita b"></span>`
    + `<div class="folha"><div class="area">${img}</div>`
    + `<div class="rodape"><b>${linhas(legenda[0])}</b><span>${linhas(legenda[1])}</span></div></div></div>`;
}
