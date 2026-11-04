import { describe, expect, it } from "vitest";
import { chavePacote, classifica, diasEntre, hojeSP } from "../src/lib/painel/classifica.ts";

const HOJE = "2026-11-04";
const p = (nome: string, chegouEm: string, modo: "auto" | "nova" | "exc" | "base" = "auto") => ({ nome, chegouEm, modo });

describe("classifica", () => {
  it("o manual sempre vence", () => {
    expect(classifica(p("13K", HOJE, "base"), 60, HOJE)).toBe("base");
    expect(classifica(p("13K", "2020-01-01", "nova"), 60, HOJE)).toBe("nova");
  });
  it("sem nome ou o catálogo do Ari é base", () => {
    expect(classifica(p("", HOJE), 60, HOJE)).toBe("base");
    expect(classifica(p("Ari Ribeiro karaoke ", HOJE), 60, HOJE)).toBe("base");
  });
  it("EXCLUSIVO é só no Ari", () => {
    expect(classifica(p("ARI EXCLUSIVO", HOJE), 60, HOJE)).toBe("exc");
  });
  it("dentro do prazo é novidade; no prazo ou depois, base", () => {
    expect(classifica(p("13K", "2026-10-01"), 60, HOJE)).toBe("nova");
    expect(classifica(p("13K", "2026-09-05"), 60, HOJE)).toBe("base");
  });
});

describe("chavePacote", () => {
  it("junta grafias do mesmo pacote", () => {
    expect(chavePacote(" 13k  ")).toBe("13K");
    expect(chavePacote("13K")).toBe("13K");
    expect(chavePacote("inter   14g")).toBe("INTER 14G");
  });
});

describe("datas", () => {
  it("hoje é a data de Brasília", () => {
    expect(hojeSP(new Date("2026-11-05T02:30:00Z"))).toBe("2026-11-04");
    expect(hojeSP(new Date("2026-11-05T03:30:00Z"))).toBe("2026-11-05");
  });
  it("conta dias entre datas", () => {
    expect(diasEntre("2026-09-05", "2026-11-04")).toBe(60);
    expect(diasEntre("2026-11-04", "2026-11-04")).toBe(0);
  });
});
