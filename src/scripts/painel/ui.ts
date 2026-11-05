/** Peças de interface dividas pelas telas do painel. */
import { escapa } from "../../lib/texto.ts";
import { ErroApi } from "./api.ts";

export { escapa };

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel)!;

/** Recado rápido no pé da tela ("Salvo", erros). */
export function aviso(texto: string, tipo: "ok" | "erro" = "ok") {
  const a = $("#aviso");
  a.textContent = texto;
  a.dataset.tipo = tipo;
  a.classList.add("on");
  clearTimeout(Number(a.dataset.t));
  a.dataset.t = String(setTimeout(() => a.classList.remove("on"), tipo === "erro" ? 6000 : 3000));
}

/** O botão vira "✓ Salvo" (verde) por 2 s: confirmação no lugar onde o Ari tocou. */
export function marcaSalvo(botao: HTMLButtonElement, texto = "Salvo") {
  if (!botao.isConnected) return;
  const original = botao.dataset.original ?? botao.innerHTML;
  botao.dataset.original = original;
  botao.classList.add("salvo");
  botao.textContent = `✓ ${texto}`;
  clearTimeout(Number(botao.dataset.tSalvo));
  botao.dataset.tSalvo = String(setTimeout(() => {
    botao.classList.remove("salvo");
    botao.innerHTML = original;
    delete botao.dataset.original;
  }, 2000));
}

/**
 * Botão mostra que está trabalhando e não aceita segundo toque; erro da API vira aviso.
 * Com `salvo`, o botão confirma ("✓ Salvo") quando dá certo.
 */
export async function comCarregando(botao: HTMLButtonElement, fn: () => Promise<void>, salvo?: string): Promise<boolean> {
  if (botao.getAttribute("aria-busy") === "true") return false;
  botao.setAttribute("aria-busy", "true");
  botao.disabled = true;
  try {
    await fn();
    if (salvo) marcaSalvo(botao, salvo);
    return true;
  } catch (e) {
    aviso(e instanceof ErroApi ? e.message : "Algo deu errado. Tente de novo.", "erro");
    return false;
  } finally {
    botao.removeAttribute("aria-busy");
    botao.disabled = false;
  }
}

export interface OpcoesCampo {
  id: string;
  rotulo: string;
  valor: string;
  dica?: string;
  max?: number;
  prefixo?: string;
  tipo?: "text" | "tel" | "number";
  inputmode?: string;
  autocomplete?: string;
  /** textarea em vez de input */
  multilinha?: boolean;
}

/** Campo com rótulo, dica, prefixo opcional ("@") e lugar pro erro, já ligados pra leitor de tela. */
export function campo(o: OpcoesCampo): string {
  const desc = [o.dica ? `dica-${o.id}` : "", `erro-${o.id}`].filter(Boolean).join(" ");
  return `<div class="campo">`
    + `<label for="${o.id}">${escapa(o.rotulo)}</label>`
    + (o.dica ? `<p class="dica" id="dica-${o.id}">${escapa(o.dica)}</p>` : "")
    + `<div class="entrada">${o.prefixo ? `<span class="prefixo" aria-hidden="true">${escapa(o.prefixo)}</span>` : ""}`
    + (o.multilinha
      ? `<textarea id="${o.id}" name="${o.id}" rows="3" aria-describedby="${desc}"`
      : `<input id="${o.id}" name="${o.id}" type="${o.tipo ?? "text"}" value="${escapa(o.valor)}" aria-describedby="${desc}"`)
    + (o.max ? ` maxlength="${o.max + 10}" data-max="${o.max}"` : "")
    + (o.inputmode ? ` inputmode="${o.inputmode}"` : "")
    + ` autocomplete="${o.autocomplete ?? "off"}"` + (o.multilinha ? `>${escapa(o.valor)}</textarea>` : " />")
    + (o.max ? `<span class="conta" aria-hidden="true"></span>` : "")
    + `</div><p class="erro" id="erro-${o.id}" aria-live="polite"></p></div>`;
}

export function erroNoCampo(raiz: ParentNode, id: string, mensagem: string | null) {
  const input = $<HTMLInputElement>("#" + id, raiz);
  $("#erro-" + id, raiz).textContent = mensagem ?? "";
  if (mensagem) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

export function limpaErros(raiz: ParentNode) {
  raiz.querySelectorAll<HTMLInputElement>("[aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"));
  raiz.querySelectorAll(".erro").forEach((p) => (p.textContent = ""));
}

/** Contador "12/14" nos campos com limite; passa do limite → vermelho. Devolve se está tudo dentro. */
export function atualizaContadores(raiz: ParentNode): boolean {
  let ok = true;
  raiz.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-max]").forEach((i) => {
    const max = Number(i.dataset.max), n = [...i.value.normalize("NFC")].length;
    const conta = i.parentElement!.querySelector(".conta");
    if (conta) conta.textContent = `${n}/${max}`;
    i.parentElement!.classList.toggle("passou", n > max);
    if (n > max) ok = false;
  });
  return ok;
}

export const cabecalho = (titulo: string, sub: string, extra = "") =>
  `<header class="cab-tela"><div><h1>${escapa(titulo)}</h1><p class="sub">${escapa(sub)}</p></div>${extra}</header>`;

/** Quadro "Assim fica no site": o resultado desenhado com as peças do site (`html` já escapado). */
export const noSite = (html: string, escuro = false, id = "") =>
  `<section class="no-site${escuro ? " escuro" : ""}"${id ? ` id="${id}"` : ""} aria-label="Assim fica no site">`
  + `<p class="no-site-rot" aria-hidden="true"><span>Assim fica no site</span></p>${html}</section>`;

/** Linha da comanda: "Músicas no ar ........ 13.090" (`valor` já escapado). */
export const linhaComanda = (rotulo: string, valor: string) =>
  `<li><span>${escapa(rotulo)}</span><span class="pontos" aria-hidden="true"></span><b>${valor}</b></li>`;

/** Comanda (o papel do pedido no site), usada pra resumir números. */
export const comanda = (titulo: string, lado: string, linhas: string, pe = "") =>
  `<section class="comanda" aria-label="${escapa(titulo)}"><header><b>${escapa(titulo)}</b><span>${escapa(lado)}</span></header>`
  + `<ul>${linhas}</ul>${pe ? `<div class="comanda-pe">${pe}</div>` : ""}</section>`;

export const numero = (x: number) => x.toLocaleString("pt-BR");

export interface OpcoesArquivo {
  id: string;
  accept: string;
  /** texto do botão ("Escolher foto") */
  botao: string;
  /** o que aparece antes de escolher ("Nenhuma foto escolhida") */
  vazio: string;
  /** id da dica que descreve o campo */
  dica?: string;
}

/**
 * Seletor de arquivo em pt-BR: o botão nativo vem na língua do navegador ("Choose File"), então o input fica
 * invisível (mas focável e com o rótulo do campo) e um botão nosso abre a escolha. O nome do arquivo aparece ao lado.
 */
export const escolheArquivo = (o: OpcoesArquivo) =>
  `<div class="arquivo"><input type="file" id="${o.id}" accept="${escapa(o.accept)}"${o.dica ? ` aria-describedby="${o.dica}"` : ""} />`
  + `<label class="bt claro pequeno-claro" for="${o.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>${escapa(o.botao)}</label>`
  + `<span class="arquivo-nome" data-vazio="${escapa(o.vazio)}" aria-hidden="true">${escapa(o.vazio)}</span></div>`;

/** Mostra o nome do arquivo escolhido ao lado do botão, em qualquer tela (um ouvinte só, no documento). */
export function ligaArquivos() {
  document.addEventListener("change", (ev) => {
    const input = ev.target as HTMLInputElement;
    if (input.type !== "file" || !input.closest(".arquivo")) return;
    const nome = input.closest(".arquivo")!.querySelector<HTMLElement>(".arquivo-nome")!;
    const arquivo = input.files?.[0];
    nome.textContent = arquivo?.name ?? nome.dataset.vazio ?? "";
    nome.classList.toggle("tem", !!arquivo);
  }, true);
}
