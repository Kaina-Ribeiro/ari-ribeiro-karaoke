import type { Banner, Contato, FonteCatalogo, Novidades } from "./tipos.ts";

/**
 * O site como estava antes do painel. Vale enquanto o Ari não salvar nada (e é o que a importação grava),
 * então no dia da troca o site fica igual.
 */
export const CONFIG_PADRAO: { contato: Contato; banner: Banner; catalogo: FonteCatalogo; novidades: Novidades } = {
  contato: { zapContato: "5512991167274", zapKj: null, instagram: "ariribeirokaraoke", facebook: null },
  banner: {
    linhas: ["Solta", "a voz,", "o palco é seu."],
    frase: "Acha a música, anota o *código* e manda pro KJ.",
    legenda: ["Com Ari Ribeiro", "aqui a diversão é garantida"],
    foto: { chave: "fotos/ari-cantando.webp", recortada: true },
  },
  catalogo: { fonte: "link", link: "https://docs.google.com/spreadsheets/d/1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx", arquivo: null },
  novidades: { prazoDias: 60 },
};
