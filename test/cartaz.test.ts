import { describe, expect, it } from "vitest";
import { htmlLetreiro, htmlPoster, letreiro, negrito, quebraNoMeio, rotuloLetreiro } from "../src/lib/painel/cartaz.ts";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";

const linhas = CONFIG_PADRAO.banner.linhas;

describe("letreiro", () => {
  it("separa palavras; na última linha, o começo é serif e a última palavra é ouro", () => {
    expect(letreiro(linhas)).toEqual([
      [{ texto: "Solta", classe: "" }],
      [{ texto: "a", classe: "" }, { texto: "voz,", classe: "" }],
      [{ texto: "o palco é", classe: "serif" }, { texto: "seu.", classe: "ouro" }],
    ]);
  });
  it("linhas vazias saem; uma palavra só na última linha vira ouro", () => {
    expect(letreiro(["Canta", "", ""])).toEqual([[{ texto: "Canta", classe: "ouro" }]]);
  });
  it("gera o mesmo HTML do site de hoje", () => {
    expect(htmlLetreiro(linhas)).toBe(
      '<span class="l"><span class="w">Solta</span></span>'
      + '<span class="l"><span class="w">a</span> <span class="w">voz,</span></span>'
      + '<span class="l"><span class="w serif">o palco é</span> <span class="w ouro">seu.</span></span>',
    );
  });
  it("escapa o texto do Ari", () => {
    expect(htmlLetreiro(["<b>", "", ""])).toContain("&lt;b&gt;");
  });
  it("rótulo pra leitor de tela, sem pontuação no fim", () => {
    expect(rotuloLetreiro(linhas)).toBe("Solta a voz, o palco é seu");
  });
});

describe("legenda e frase", () => {
  it("quebra no espaço mais perto do meio", () => {
    expect(quebraNoMeio("Com Ari Ribeiro")).toEqual(["Com Ari", "Ribeiro"]);
    expect(quebraNoMeio("aqui a diversão é garantida")).toEqual(["aqui a diversão", "é garantida"]);
    expect(quebraNoMeio("Ari")).toEqual(["Ari", ""]);
  });
  it("*palavra* fica em negrito", () => {
    expect(negrito("anota o *código* e")).toEqual([
      { texto: "anota o ", forte: false },
      { texto: "código", forte: true },
      { texto: " e", forte: false },
    ]);
    expect(negrito("sem nada")).toEqual([{ texto: "sem nada", forte: false }]);
  });
});

describe("pôster", () => {
  it("foto recortada fica como hoje, com a legenda quebrada em duas linhas", () => {
    const h = htmlPoster(CONFIG_PADRAO.banner.legenda, { src: "/img/painel/abc.webp", recortada: true });
    expect(h).toContain('<img src="/img/painel/abc.webp" alt="" fetchpriority="high" />');
    expect(h).toContain("<b>Com Ari<br />Ribeiro</b><span>aqui a diversão<br />é garantida</span>");
    expect(h).toContain('class="poster" aria-hidden="true"');
  });
  it("foto comum preenche a área", () => {
    expect(htmlPoster(["a", "b"], { src: "/x.webp", recortada: false })).toContain('<img class="cheia" src="/x.webp"');
  });
  it("escapa a legenda", () => {
    expect(htmlPoster(["<i>", ""], { src: "/x.webp", recortada: true })).toContain("&lt;i&gt;");
  });
});
