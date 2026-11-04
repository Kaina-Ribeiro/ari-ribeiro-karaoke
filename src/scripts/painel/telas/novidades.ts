import type { Modo } from "../../../lib/painel/tipos.ts";
import { validaNovidades } from "../../../lib/painel/valida.ts";
import { normaliza } from "../../../lib/texto.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { $, aviso, cabecalho, campo, comCarregando, erroNoCampo, escapa, limpaErros } from "../ui.ts";

const MODOS: [Modo, string][] = [["auto", "Automático"], ["nova", "Novidade"], ["exc", "Só no Ari"], ["base", "Normal"]];
const ETIQUETA = { nova: `<span class="tag nova">nova</span>`, exc: `<span class="tag exc">só no Ari</span>`, base: `<span class="tag base">normal</span>` };
const data = (iso: string) => iso.split("-").reverse().join("/");

function linhas(e: Estado): string {
  if (!e.pacotes.length) return `<p class="vazio">Nenhum pacote ainda. Eles aparecem aqui depois da primeira publicação.</p>`;
  return `<ul class="pacotes">` + e.pacotes.map((p) => `<li class="pacote" data-chave="${escapa(p.chave)}" data-busca="${escapa(normaliza(p.nome))}" data-classe="${p.classe}">`
    + `<div class="info"><b class="nome">${escapa(p.nome)}</b>${ETIQUETA[p.classe]}`
    + `<span class="meta">Chegou em ${data(p.chegouEm)}, ${p.musicas.toLocaleString("pt-BR")} ${p.musicas === 1 ? "música" : "músicas"}</span></div>`
    + `<div class="entrada seletor"><select aria-label="Classificação de ${escapa(p.nome)}">`
    + MODOS.map(([m, nome]) => `<option value="${m}"${p.modo === m ? " selected" : ""}>${nome}</option>`).join("")
    + `</select></div></li>`).join("") + `</ul>`;
}

export function montaNovidades(el: HTMLElement, e: Estado) {
  el.innerHTML = cabecalho("Novidades", "O que aparece no site com a etiqueta nova ou só no Ari.")
    + `<form class="folha" id="formPrazo" novalidate><h2>Automático</h2>`
    + `<p>Pacote novo aparece como novidade por um tempo, contado do dia em que chegou. Depois vira normal sozinho.</p>`
    + campo({ id: "prazo", rotulo: "Dias como novidade", valor: String(e.novidades.prazoDias), tipo: "number", inputmode: "numeric" })
    + `<div class="acoes"><button class="bt" type="submit">Salvar prazo</button></div></form>`
    + `<section class="folha"><h2>Pacotes</h2>`
    + `<p>A escolha aqui vence o automático. "Automático" volta a seguir o prazo.</p>`
    + `<div class="filtros">${campo({ id: "buscaPacote", rotulo: "Buscar pacote", valor: "" })}`
    + `<label class="marcar"><input type="checkbox" id="soNovas" /> Só os que estão como Novidade</label></div>`
    + `<div id="listaPacotes">${linhas(e)}</div><p class="vazio" id="nadaAchado" hidden>Nenhum pacote com esse nome.</p></section>`;

  /* prazo */
  const form = $<HTMLFormElement>("#formPrazo", el);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    limpaErros(form);
    const r = validaNovidades({ prazoDias: Number($<HTMLInputElement>("#prazo", form).value) });
    if (!r.ok) { erroNoCampo(form, "prazo", r.erro); return; }
    await comCarregando($<HTMLButtonElement>("button[type=submit]", form), async () => {
      await api("PUT", "/api/admin/novidades", r.valor);
      aviso("Salvo. Publicando o site…");
      const novo = await carrega();
      if (novo) { $("#listaPacotes", el).innerHTML = linhas(novo); filtra(); }
    });
  });

  /* filtros */
  const busca = $<HTMLInputElement>("#buscaPacote", el);
  const soNovas = $<HTMLInputElement>("#soNovas", el);
  function filtra() {
    const q = normaliza(busca.value);
    let visiveis = 0;
    el.querySelectorAll<HTMLElement>(".pacote").forEach((li) => {
      li.hidden = (!!q && !li.dataset.busca!.includes(q)) || (soNovas.checked && li.dataset.classe !== "nova");
      if (!li.hidden) visiveis++;
    });
    $("#nadaAchado", el).hidden = visiveis > 0 || !el.querySelector(".pacote");
  }
  busca.addEventListener("input", filtra);
  soNovas.addEventListener("change", filtra);

  /* classificação: salva ao escolher */
  $("#listaPacotes", el).addEventListener("change", async (ev) => {
    const sel = ev.target as HTMLSelectElement;
    const li = sel.closest<HTMLElement>(".pacote")!;
    li.setAttribute("aria-busy", "true");
    sel.disabled = true;
    try {
      await api("PUT", `/api/admin/pacotes/${encodeURIComponent(li.dataset.chave!)}`, { modo: sel.value });
      aviso("Salvo. Publicando o site…");
      const novo = await carrega();
      const p = novo?.pacotes.find((x) => x.chave === li.dataset.chave);
      if (p) {
        li.dataset.classe = p.classe;
        li.querySelector(".tag")!.outerHTML = ETIQUETA[p.classe];
      }
    } catch (erro) {
      aviso((erro as Error).message, "erro");
    } finally {
      li.removeAttribute("aria-busy");
      sel.disabled = false;
      filtra();
    }
  });
}
