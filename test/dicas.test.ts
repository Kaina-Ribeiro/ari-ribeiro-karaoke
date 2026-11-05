import { describe, expect, it } from "vitest";
import { preparaItem } from "../src/lib/busca.ts";
import { sorteiaDicas, LIMITE_DICA } from "../src/lib/dicas.ts";
import type { Pacote } from "../src/lib/texto.ts";

const cat: [string, string, string, Pacote][] = [
  ["4973", "Zezé Di Camargo & Luciano", "É o Amor", "base"],
  ["1010", "14 Bis", "Planeta Sonho", "base"],
  ["2020", "Roupa Nova", "Whisky a Go-Go", "base"],
  ["3030", "Marília Mendonça", "Infiel", "nova"],
  ["4040", "Banda com um nome comprido demais", "Uma música com o título longo demais", "nova"],
  ["5050", "Ari Ribeiro", "Só no Ari", "exc"],
  ["6060", "Ana Castela", "Pipoco", "nova"],
];
const itens = cat.map(([c, a, t, p], i) => preparaItem(i, c, a, t, p));
/** sorte fixa: sempre o mesmo resultado no teste */
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };

describe("sorteiaDicas", () => {
  it("um código, um cantor, uma música e uma novidade, cada uma buscando o que mostra", () => {
    const d = sorteiaDicas(itens, seq(0, 0.2, 0.4, 0.1));
    expect(d.map((x) => x.tipo)).toEqual(["codigo", "cantor", "musica", "nova"]);
    for (const x of d) expect(x.q).toBe(x.texto);
    expect(d[0].texto).toMatch(/^\d+$/);
    expect(itens.some((m) => m.artista === d[1].texto)).toBe(true);
    expect(itens.some((m) => m.titulo === d[2].texto)).toBe(true);
    expect(itens.find((m) => m.titulo === d[3].texto)!.pacote).toBe("nova");
  });

  it("só textos curtos, pra caber no celular", () => {
    for (let k = 0; k < 50; k++) {
      for (const x of sorteiaDicas(itens)) expect([...x.texto].length).toBeLessThanOrEqual(LIMITE_DICA);
    }
  });

  it("não repete o que estava na tela antes, quando dá", () => {
    let antes = sorteiaDicas(itens);
    for (let k = 0; k < 30; k++) {
      const agora = sorteiaDicas(itens, Math.random, antes);
      for (let i = 0; i < 4; i++) if (agora[i].tipo === antes[i].tipo) expect(agora[i].texto).not.toBe(antes[i].texto);
      antes = agora;
    }
  });

  it("sem novidade no catálogo, a quarta vira outra música", () => {
    const semNova = itens.filter((m) => m.pacote !== "nova");
    const d = sorteiaDicas(semNova);
    expect(d.map((x) => x.tipo)).toEqual(["codigo", "cantor", "musica", "musica"]);
    expect(d[2].texto).not.toBe(d[3].texto);
  });

  it("catálogo vazio: nada pra sugerir", () => {
    expect(sorteiaDicas([])).toEqual([]);
  });
});
