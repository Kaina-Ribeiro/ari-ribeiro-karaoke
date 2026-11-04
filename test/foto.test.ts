import { describe, expect, it } from "vitest";
import { temTransparencia } from "../src/scripts/painel/foto.ts";

/** Imagem RGBA de `n` pixels, com `transparentes` deles com alfa 0. */
function pixels(n: number, transparentes: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(n * 4).fill(255);
  for (let i = 0; i < transparentes; i++) d[i * 4 + 3] = 0;
  return d;
}

describe("temTransparencia", () => {
  it("foto toda opaca: não é recortada", () => {
    expect(temTransparencia(pixels(10_000, 0))).toBe(false);
  });
  it("menos de 1% transparente (cantinho, ruído): não é recortada", () => {
    expect(temTransparencia(pixels(10_000, 50))).toBe(false);
  });
  it("2% transparente: é recortada", () => {
    expect(temTransparencia(pixels(10_000, 200))).toBe(true);
  });
  it("alfa quase cheio (250+) conta como opaco", () => {
    const d = pixels(100, 0);
    for (let i = 0; i < 100; i++) d[i * 4 + 3] = 252;
    expect(temTransparencia(d)).toBe(false);
  });
});
