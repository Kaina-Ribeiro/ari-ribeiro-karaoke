import { describe, expect, it } from "vitest";
import { busca, NOTA_CODIGO_EXATO, preparaItem, quase, trechosQueBatem } from "../src/lib/busca.ts";
import { normaliza } from "../src/lib/texto.ts";

const itens = [
  preparaItem(0, "4973", "A-Ha", "Take On Me", "base"),
  preparaItem(1, "1500", "14 Bis", "Canção da América", "base"),
  preparaItem(2, "6549", "365", "São Paulo", "nova"),
  preparaItem(3, "04973", "Outro", "Take Me Home", "exc"),
];
const letras = ["we're talking away", "amigo e coisa pra se guardar", "", "take me home country roads"].map(normaliza);
const codigos = (r: ReturnType<typeof busca>) => r.sort((a, b) => b.nota - a.nota).map((x) => x.item.codigo);

describe("quase", () => {
  it("aceita um erro de digitação", () => {
    expect(quase("take", "tak")).toBe(true);
    expect(quase("cancao", "cancoa")).toBe(false);
    expect(quase("cancao", "cancoes")).toBe(false);
    expect(quase("america", "amerca")).toBe(true);
    expect(quase("abc", "xyz")).toBe(false);
  });
});

describe("busca", () => {
  it("código exato vem primeiro e ignora zero à esquerda", () => {
    const r = busca(itens, "4973");
    expect(r.every((x) => x.nota === NOTA_CODIGO_EXATO)).toBe(true);
    expect(codigos(r)).toEqual(["4973", "04973"]);
  });
  it("começo de código também acha", () => {
    expect(codigos(busca(itens, "15"))).toEqual(["1500"]);
  });
  it("sem acento e com erro de digitação", () => {
    expect(codigos(busca(itens, "cancao"))).toEqual(["1500"]);
    expect(codigos(busca(itens, "tak on me"))[0]).toBe("4973");
  });
  it("título exato ganha do parecido", () => {
    expect(codigos(busca(itens, "take me home"))[0]).toBe("04973");
  });
  it("acha pelo começo da letra só quando as letras carregaram", () => {
    expect(busca(itens, "amigo e coisa")).toEqual([]);
    const r = busca(itens, "amigo e coisa", letras);
    expect(codigos(r)).toEqual(["1500"]);
    expect(r[0].pelaLetra).toBe(true);
  });
  it("pedaço do meio da letra só conta com 6+ letras", () => {
    expect(busca(itens, "talk", letras)).toEqual([]);
    expect(codigos(busca(itens, "talking away", letras))).toEqual(["4973"]);
  });
  it("respeita o filtro", () => {
    expect(codigos(busca(itens, "take", undefined, (m) => m.pacote === "exc"))).toEqual(["04973"]);
  });
  it("busca vazia devolve tudo", () => {
    expect(busca(itens, "  ")).toHaveLength(4);
  });
});

describe("trechosQueBatem", () => {
  it("grifa no texto original mesmo com acento", () => {
    expect(trechosQueBatem("Canção da América", "cancao")).toEqual([[0, 6]]);
  });
  it("não grifa número", () => {
    expect(trechosQueBatem("Take 5", "5")).toEqual([]);
  });
  it("modo frase grifa a busca inteira", () => {
    expect(trechosQueBatem("Amigo é coisa pra se guardar", "amigo e coisa", true)).toEqual([[0, 13]]);
  });
});
