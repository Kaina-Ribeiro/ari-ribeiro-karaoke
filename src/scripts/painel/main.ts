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
import { $, aviso, comCarregando, escapa } from "./ui.ts";

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

let montada = "";
function mostraTela(forcar = false) {
  const { estado } = atual();
  const id = telaAtual();
  document.querySelectorAll<HTMLAnchorElement>("nav.abas a").forEach((a) => {
    if (a.hash === "#" + id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (!estado) return;
  // o Início mostra o status em grande: redesenha a cada consulta (não tem campo pra perder)
  if (montada === id && !forcar) { if (id === "inicio") montaInicio($("#tela"), estado); return; }
  montada = id;
  const el = $("#tela");
  TELAS[id](el, estado);
  el.focus({ preventScroll: true });
  scrollTo(0, 0);
}

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
