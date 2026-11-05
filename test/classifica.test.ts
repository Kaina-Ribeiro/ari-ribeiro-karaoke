import { describe, expect, it } from "vitest";
import { chavePacote, classifica, diasEntre, hojeSP, novidadeAte } from "../src/lib/painel/classifica.ts";

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
  it("ARI RIBEIRO e ESPECIAL ARI são só no Ari, chegando hoje ou há anos", () => {
    for (const nome of ["ARI RIBEIRO", "ESPECIAL ARI", " ari  ribeiro ", "Especial Ari"]) {
      expect(classifica(p(nome, HOJE), 60, HOJE)).toBe("exc");
      expect(classifica(p(nome, "2020-01-01"), 60, HOJE)).toBe("exc");
    }
  });
  it("ARI RIBEIRO KARAOKE continua sendo o catálogo base, mesmo recém-chegado", () => {
    expect(classifica(p("ARI RIBEIRO KARAOKE", HOJE), 60, HOJE)).toBe("base");
    // só o nome exato vira só no Ari
    expect(classifica(p("ARI RIBEIRO 2", HOJE), 60, HOJE)).toBe("nova");
  });
  it("a escolha manual vence os nomes fixos", () => {
    expect(classifica(p("ARI RIBEIRO", HOJE, "base"), 60, HOJE)).toBe("base");
    expect(classifica(p("ESPECIAL ARI", HOJE, "nova"), 60, HOJE)).toBe("nova");
    expect(classifica(p("ARI EXCLUSIVO", HOJE, "base"), 60, HOJE)).toBe("base");
    expect(classifica(p("ARI RIBEIRO KARAOKE", HOJE, "exc"), 60, HOJE)).toBe("exc");
  });
  it("os pacotes de 04/11 seguem novidade até 03/01/2027, inclusive, e viram normais em 04/01/2027", () => {
    const chegou = "2026-11-04";
    expect(novidadeAte(chegou, 60)).toBe("2027-01-03");
    expect(classifica(p("13K", chegou), 60, "2027-01-03")).toBe("nova");
    expect(classifica(p("13K", chegou), 60, "2027-01-04")).toBe("base");
  });
  it("até o último dia do prazo é novidade; no dia seguinte, base", () => {
    expect(classifica(p("13K", "2026-10-01"), 60, HOJE)).toBe("nova");
    expect(classifica(p("13K", "2026-09-05"), 60, HOJE)).toBe("nova");
    expect(classifica(p("13K", "2026-09-04"), 60, HOJE)).toBe("base");
  });
});

describe("chavePacote", () => {
  it("junta grafias do mesmo pacote", () => {
    expect(chavePacote(" 13k  ")).toBe("13K");
    expect(chavePacote("13K")).toBe("13K");
    expect(chavePacote("inter   14g")).toBe("INTER 14G");
  });
  it("acento escrito de outro jeito (planilha exportada no Mac) é o mesmo pacote", () => {
    expect(chavePacote("Ão Vivo")).toBe(chavePacote("Ão Vivo"));
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
