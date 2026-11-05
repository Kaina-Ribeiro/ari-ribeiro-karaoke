/** Painel do Ari: faixa de status, abas por #hash e a tela atual. */
import { api } from "./api.ts";
import { assina, atual, carrega, type Estado } from "./estado.ts";
import { textoStatus } from "./status.ts";
import { montaBanner } from "./telas/banner.ts";
import { montaCatalogo } from "./telas/catalogo.ts";
import { montaContato } from "./telas/contato.ts";
import { montaFesta } from "./telas/festa.ts";
import { montaInicio } from "./telas/inicio.ts";
import { montaNovidades } from "./telas/novidades.ts";
import { $, aviso, comCarregando, escapa, ligaArquivos } from "./ui.ts";

type Montador = (el: HTMLElement, e: Estado) => void;
/** id da aba → tela. A ordem e os nomes das abas estão no HTML (admin/index.astro). */
const TELAS: Record<string, Montador> = {
  inicio: montaInicio,
  catalogo: montaCatalogo,
  novidades: montaNovidades,
  banner: montaBanner,
  festa: montaFesta,
  contato: montaContato,
};

const telaAtual = () => {
  const id = location.hash.slice(1);
  return id in TELAS ? id : "inicio";
};

const abas = $("nav.abas");
const computador = matchMedia("(min-width:1024px)");

/**
 * A etiqueta amarela (.marcador) vai até a aba atual: no computador cobre a linha inteira, no celular só o ícone.
 * `animar = false` põe no lugar sem deslizar (primeira vez e quando a tela muda de tamanho).
 */
function posicionaMarcador(animar = true) {
  const a = abas.querySelector<HTMLAnchorElement>("a[aria-current]");
  if (!a) { abas.classList.remove("pronto"); return; }
  if (!animar) abas.classList.add("parado");
  // .pronto antes de medir: sem ele a aba atual se pinta sozinha (torta e mais larga) e a medida sai errada
  abas.classList.add("pronto");
  const alvo = computador.matches ? a : a.querySelector("svg")!;
  const r = alvo.getBoundingClientRect(), base = abas.getBoundingClientRect();
  abas.style.setProperty("--x", `${r.left - base.left}px`);
  abas.style.setProperty("--y", `${r.top - base.top}px`);
  abas.style.setProperty("--w", `${r.width}px`);
  abas.style.setProperty("--h", `${r.height}px`);
  if (!animar) { void abas.offsetWidth; abas.classList.remove("parado"); }
}
new ResizeObserver(() => posicionaMarcador(false)).observe(abas);
document.fonts?.ready.then(() => posicionaMarcador(false));

let montada = "";
let tEntrada = 0;
function mostraTela(forcar = false) {
  const { estado } = atual();
  const id = telaAtual();
  document.querySelectorAll<HTMLAnchorElement>("nav.abas a").forEach((a) => {
    if (a.hash === "#" + id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  posicionaMarcador(abas.classList.contains("pronto"));
  if (!estado) return;
  // o Início mostra o status em grande: redesenha a cada consulta (não tem campo pra perder)
  if (montada === id && !forcar) { if (id === "inicio") montaInicio($("#tela"), estado); return; }
  montada = id;
  const el = $("#tela");
  TELAS[id](el, estado);
  // entrada da tela: as peças sobem em cascata uma vez (o Início redesenha sem repetir a animação)
  el.classList.remove("entra");
  void el.offsetWidth;
  el.classList.add("entra");
  clearTimeout(tEntrada);
  tEntrada = window.setTimeout(() => el.classList.remove("entra"), 900);
  el.focus({ preventScroll: true });
  scrollTo(0, 0);
}

ligaArquivos();

function desenhaQuem() {
  const email = atual().estado?.email;
  if (!email) return;
  const b = $("#email");
  b.textContent = email;
  b.title = email;
}

function desenhaStatus() {
  const { estado, erro } = atual();
  const s = $("#status");
  if (erro) {
    s.dataset.tipo = "falhou";
    s.innerHTML = `<span class="luz" aria-hidden="true"></span><span class="txt">${escapa(erro)}</span>`;
    return;
  }
  if (!estado) return;
  const { tipo, texto } = textoStatus(estado.publicacao, new Date());
  s.dataset.tipo = tipo;
  s.innerHTML = `<span class="luz" aria-hidden="true"></span><span class="txt">${escapa(texto)}</span>`
    + (tipo === "falhou" || tipo === "demorando" ? `<button class="bt pequeno" type="button" id="tentar">Tentar de novo</button>` : "");
  s.querySelector<HTMLButtonElement>("#tentar")?.addEventListener("click", (ev) =>
    comCarregando(ev.currentTarget as HTMLButtonElement, async () => {
      await api("POST", "/api/admin/publicar", { motivo: "tentar-de-novo" });
      aviso("Pedido de novo. Publicando…");
      await carrega();
    }));
}

assina(() => { desenhaQuem(); desenhaStatus(); mostraTela(); });
addEventListener("hashchange", () => mostraTela(true));
carrega();
