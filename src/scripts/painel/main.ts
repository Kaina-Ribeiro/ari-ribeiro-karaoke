/** Painel do Ari: faixa de status, abas por #hash e a tela atual. */
import { api } from "./api.ts";
import { assina, atual, carrega, type Estado } from "./estado.ts";
import { textoStatus } from "./status.ts";
import { montaContato } from "./telas/contato.ts";
import { montaInicio } from "./telas/inicio.ts";
import { $, aviso, cabecalho, comCarregando, escapa } from "./ui.ts";

type Montador = (el: HTMLElement, e: Estado) => void;
const emBreve = (titulo: string): Montador => (el) => { el.innerHTML = cabecalho(titulo, "Em construção."); };

/** id da aba → tela. A ordem e os nomes das abas estão no HTML (admin/index.astro). */
const TELAS: Record<string, Montador> = {
  inicio: montaInicio,
  catalogo: emBreve("Catálogo"),
  novidades: emBreve("Novidades"),
  banner: emBreve("Banner"),
  festa: emBreve("Pra sua festa"),
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
  if (!estado || (montada === id && !forcar)) return;
  montada = id;
  const el = $("#tela");
  TELAS[id](el, estado);
  el.focus({ preventScroll: true });
  scrollTo(0, 0);
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

assina(() => { desenhaStatus(); mostraTela(); });
addEventListener("hashchange", () => mostraTela(true));
carrega();
