import { describe, expect, it } from "vitest";
import { letraDe, normaliza, tipoPacote, tituloBonito } from "../src/lib/texto.ts";

describe("normaliza", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normaliza("CANÇÃO PRA NÃO VOLTAR!")).toBe("cancao pra nao voltar");
    expect(normaliza("  Tô  Nem  Aí ")).toBe("to nem ai");
  });
  it("junta os tipos de apóstrofo", () => {
    expect(normaliza("DON´T STOP")).toBe(normaliza("Don’t Stop"));
  });
});

describe("tituloBonito", () => {
  it("passa de MAIÚSCULAS pra título", () => {
    expect(tituloBonito("SÃO PAULO")).toBe("São Paulo");
    expect(tituloBonito("CANÇÃO DA AMÉRICA")).toBe("Canção da América");
  });
  it("troca o acento agudo por apóstrofo", () => {
    expect(tituloBonito("DON´T STOP ME NOW")).toBe("Don’t Stop Me Now");
  });
});

describe("tipoPacote", () => {
  it("separa base, exclusiva e nova", () => {
    expect(tipoPacote("Ari Ribeiro karaoke")).toBe("base");
    expect(tipoPacote("")).toBe("base");
    expect(tipoPacote("ARI EXCLUSIVO")).toBe("exc");
    expect(tipoPacote("INTER 14G")).toBe("nova");
  });
});

describe("letraDe", () => {
  it("agrupa número e símbolo em #", () => {
    expect(letraDe("Ávila")).toBe("A");
    expect(letraDe("14 Bis")).toBe("#");
    expect(letraDe("zezé")).toBe("Z");
  });
});
