import { describe, expect, it } from "vitest";
import { chaveArtista, letraDe, nomeArtista, normaliza, tipoPacote, tituloBonito } from "../src/lib/texto.ts";

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

describe("nomeArtista", () => {
  it("tira da CAIXA ALTA nomes de várias palavras", () => {
    expect(nomeArtista("ALICE IN CHAINS")).toBe("Alice in Chains");
    expect(nomeArtista("OS BARÕES DA PISADINHA - JORGE")).toBe("Os Barões da Pisadinha - Jorge");
    expect(nomeArtista("ÁVINE E MATHEUS FERNANDES")).toBe("Ávine e Matheus Fernandes");
    expect(nomeArtista("KEVIN O CHRIS O POCAH")).toBe("Kevin O Chris O Pocah");
  });
  it("deixa sigla, número e nome de uma palavra como estão", () => {
    expect(nomeArtista("MC G15")).toBe("MC G15");
    expect(nomeArtista("DJ GUUGA - DJ IVIS")).toBe("DJ Guuga - DJ Ivis");
    expect(nomeArtista("CPM 22")).toBe("CPM 22");
    expect(nomeArtista("BTS")).toBe("BTS");
    expect(nomeArtista("AC-DC")).toBe("AC-DC");
  });
  it("não mexe em quem já está escrito direito, só no apóstrofo", () => {
    expect(nomeArtista("A Banda Mais Bonita da Cidade")).toBe("A Banda Mais Bonita da Cidade");
    expect(nomeArtista("Guns n´ Roses")).toBe("Guns n’ Roses");
  });
});

describe("chaveArtista", () => {
  it("junta grafias com pontuação diferente", () => {
    expect(chaveArtista("Guns N Roses")).toBe(chaveArtista("Guns n´ Roses"));
    expect(chaveArtista("F.R. David")).toBe(chaveArtista("FR David"));
    expect(chaveArtista("A Ha")).toBe(chaveArtista("a-ha"));
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
