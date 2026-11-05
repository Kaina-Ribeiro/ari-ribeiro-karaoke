/** Etiqueta de preço dos cartões de "Pra sua festa": opções do painel e as classes que o site e a prévia usam. */
import type { CorPreco, PesoPreco, PrecoCartao, TamanhoPreco } from "./tipos.ts";

/** Fundo da etiqueta, nas cores do site. A letra é clara no escuro e preta no claro (global.css / painel.css .preco). */
export const CORES_PRECO: { valor: CorPreco; rotulo: string }[] = [
  { valor: "tinta", rotulo: "Preto" },
  { valor: "gravata", rotulo: "Verde" },
  { valor: "brasa", rotulo: "Vermelho" },
  { valor: "luz", rotulo: "Amarelo" },
  { valor: "papel", rotulo: "Creme" },
];
export const TAMANHOS_PRECO: { valor: TamanhoPreco; rotulo: string }[] = [
  { valor: "p", rotulo: "Pequeno" },
  { valor: "m", rotulo: "Médio" },
  { valor: "g", rotulo: "Grande" },
];
export const PESOS_PRECO: { valor: PesoPreco; rotulo: string }[] = [
  { valor: "normal", rotulo: "Normal" },
  { valor: "forte", rotulo: "Negrito" },
  { valor: "extra", rotulo: "Extra" },
];

/** Estilo que o preço novo já vem: etiqueta preta, média, em negrito (lê bem em qualquer cor de cartão). */
export const ESTILO_PRECO_PADRAO: Omit<PrecoCartao, "texto"> = { cor: "tinta", tamanho: "m", peso: "forte" };

export const classesPreco = (p: Omit<PrecoCartao, "texto">): string => `preco cor-${p.cor} tam-${p.tamanho} peso-${p.peso}`;
