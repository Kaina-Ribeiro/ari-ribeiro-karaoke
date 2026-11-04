import type { Cartao } from "../../../lib/painel/tipos.ts";
import { LIMITES, validaCartao } from "../../../lib/painel/valida.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { enviaFoto } from "../foto.ts";
import { $, atualizaContadores, aviso, cabecalho, campo, comCarregando, escapa, marcaSalvo, noSite } from "../ui.ts";

const srcFoto = (chave: string) => `/api/admin/arquivos/${chave}`;

/**
 * Cada cartão é desenhado como no site (cartaz colorido e torto, sobre fundo preto), com os botões embaixo.
 * As cores seguem a posição entre os LIGADOS, como no site (global.css, .cz:nth-child(1..4)).
 */
function htmlLista(cartoes: Cartao[]): string {
  if (!cartoes.length) {
    return `<div class="vazio-bloco"><p><b>Nenhum cartão ainda.</b> Cada cartão vira um cartaz na parte "Pra sua festa" do site, com um botão que abre o seu Zap.</p>`
      + `<button class="bt" type="button" data-acao="primeiro">Criar o primeiro cartão</button></div>`;
  }
  let ligado = 0;
  return `<ol class="cartoes">` + cartoes.map((c, i) => {
    const t = escapa(c.titulo);
    const cor = c.ativo ? ` c${++ligado}` : "";
    return `<li class="cartao-item${c.ativo ? "" : " off"}" data-id="${c.id}">`
      + `<div class="cz${cor}">`
      + (c.fotoChave ? `<img class="foto" src="${escapa(srcFoto(c.fotoChave))}" alt="" />` : "")
      + `<span class="k">${escapa(c.destaque)}</span><b>${t}</b><p>${escapa(c.descricao)}</p>`
      + (c.ativo ? `<span class="ir" aria-hidden="true">Chamar no Zap →</span>` : `<span class="ir"><span class="desligado">Desligado</span>: não aparece no site</span>`)
      + `</div>`
      + `<div class="cartao-acoes">`
      + `<button class="mini" type="button" data-acao="editar" aria-label="Editar ${t}">Editar</button>`
      + `<button class="mini" type="button" data-acao="ligar" aria-label="${c.ativo ? "Desligar" : "Ligar"} ${t}">${c.ativo ? "Desligar" : "Ligar"}</button>`
      + `<button class="mini icone" type="button" data-acao="subir" aria-label="Subir ${t}" ${i === 0 ? "disabled" : ""}>↑</button>`
      + `<button class="mini icone" type="button" data-acao="descer" aria-label="Descer ${t}" ${i === cartoes.length - 1 ? "disabled" : ""}>↓</button>`
      + `<button class="mini perigo" type="button" data-acao="apagar" aria-label="Apagar ${t}">Apagar</button>`
      + `</div></li>`;
  }).join("") + `</ol>`;
}

const FEITO: Record<string, string> = { subir: "Ordem salva", descer: "Ordem salva", apagar: "Apagado" };

export function montaFesta(el: HTMLElement, e: Estado) {
  let cartoes = e.cartoes;
  let editando: number | null = null;
  el.innerHTML = cabecalho("Pra sua festa", "Os cartões de aluguel e serviços. Cada um abre o seu Zap.",
    `<button class="bt" type="button" id="novo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Novo cartão</button>`)
    + `<div class="festa-grade"><div id="editor"></div>${noSite(`<div id="lista">${htmlLista(cartoes)}</div>`, true)}</div>`
    + `<dialog id="confirma" aria-labelledby="confirmaTexto"><p id="confirmaTexto"></p>`
    + `<div class="acoes"><button class="bt claro" type="button" value="nao">Cancelar</button><button class="bt perigo" type="button" value="sim">Apagar</button></div></dialog>`;

  const lista = $("#lista", el);
  const editor = $("#editor", el);
  const marcaEditando = () => lista.querySelectorAll<HTMLElement>(".cartao-item").forEach((li) =>
    li.classList.toggle("editando", Number(li.dataset.id) === editando));
  const redesenha = async () => {
    const novo = await carrega();
    if (novo) { cartoes = novo.cartoes; lista.innerHTML = htmlLista(cartoes); marcaEditando(); }
  };
  const fechaEditor = () => { editor.innerHTML = ""; editando = null; marcaEditando(); };

  /* ---------- editor (novo ou editar) ---------- */
  function abreEditor(c?: Cartao) {
    let fotoChave = c?.fotoChave ?? null;
    editando = c?.id ?? null;
    marcaEditando();
    editor.innerHTML = `<form class="folha editor" novalidate><h2>${c ? "Editar cartão" : "Novo cartão"}</h2>`
      + campo({ id: "titulo", rotulo: "Título", valor: c?.titulo ?? "", max: LIMITES.titulo })
      + campo({ id: "destaque", rotulo: "Destaque", valor: c?.destaque ?? "", max: LIMITES.destaque, dica: "Texto pequeno em cima do título. Opcional." })
      + campo({ id: "descricao", rotulo: "Descrição", valor: c?.descricao ?? "", max: LIMITES.descricao, multilinha: true })
      + `<div class="campo"><label for="fotoCartao">Foto (opcional)</label><p class="dica" id="dica-fotoCartao">Aparece no topo do cartão, cortada em formato de tela de TV (16:9).</p>`
      + `<div class="foto-atual">${fotoChave ? `<img class="mini16" src="${escapa(srcFoto(fotoChave))}" alt="Foto atual do cartão" />` : ""}`
      + `<p class="foto-info" aria-live="polite">${fotoChave ? "Com foto." : "Sem foto."}</p>`
      + `${fotoChave ? `<button class="bt claro pequeno-claro" type="button" id="tiraFoto">Tirar foto</button>` : ""}</div>`
      + `<input type="file" id="fotoCartao" accept="image/*" aria-describedby="dica-fotoCartao" /></div>`
      + `<div class="acoes"><button class="bt" type="submit">Salvar cartão</button><button class="bt claro" type="button" id="cancela">Cancelar</button></div></form>`;
    const form = $<HTMLFormElement>("form", editor);
    const salvar = $<HTMLButtonElement>("button[type=submit]", form);
    const confere = () => { salvar.disabled = !atualizaContadores(form); };
    form.addEventListener("input", confere);
    confere();
    $<HTMLInputElement>("#titulo", form).focus();
    $("#cancela", form).addEventListener("click", fechaEditor);
    form.querySelector("#tiraFoto")?.addEventListener("click", () => {
      fotoChave = null;
      form.querySelector(".foto-atual img")?.remove();
      form.querySelector("#tiraFoto")?.remove();
      $(".foto-info", form).textContent = "Sem foto.";
    });
    const entrada = $<HTMLInputElement>("#fotoCartao", form);
    entrada.addEventListener("change", async () => {
      const arquivo = entrada.files?.[0];
      if (!arquivo) return;
      const info = $(".foto-info", form);
      info.textContent = "Preparando a foto…";
      salvar.disabled = true;
      try {
        const nova = await enviaFoto(arquivo, (f) => api("POST", "/api/admin/arquivos", f));
        fotoChave = nova.chave;
        form.querySelector(".foto-atual img")?.remove();
        info.insertAdjacentHTML("beforebegin", `<img class="mini16" src="${nova.src}" alt="Foto nova do cartão" />`);
        info.textContent = "Foto nova, ainda não salva.";
      } catch (erro) {
        info.textContent = (erro as Error).message;
      } finally {
        confere();
      }
    });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const valor = (id: string) => $<HTMLInputElement>("#" + id, form).value;
      const r = validaCartao({ titulo: valor("titulo"), destaque: valor("destaque"), descricao: valor("descricao"), ativo: c?.ativo ?? true, fotoChave });
      if (!r.ok) { aviso(r.erro, "erro"); return; }
      await comCarregando(salvar, async () => {
        await api(c ? "PUT" : "POST", c ? `/api/admin/cartoes/${c.id}` : "/api/admin/cartoes", r.valor);
        fechaEditor();
        aviso("Salvo. Publicando o site…");
        await redesenha();
      });
    });
    editor.scrollIntoView({ block: "start" });
  }
  $("#novo", el).addEventListener("click", () => abreEditor());

  /* ---------- confirmação de apagar ---------- */
  const dialogo = $<HTMLDialogElement>("#confirma", el);
  const confirma = (texto: string) => new Promise<boolean>((ok) => {
    $("#confirmaTexto", dialogo).textContent = texto;
    dialogo.showModal();
    const responde = (ev: Event) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      dialogo.removeEventListener("click", responde);
      dialogo.close();
      ok(b.value === "sim");
    };
    dialogo.addEventListener("click", responde);
    dialogo.addEventListener("cancel", () => { dialogo.removeEventListener("click", responde); ok(false); }, { once: true });
  });

  /* ---------- ações da lista ---------- */
  lista.addEventListener("click", async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-acao]");
    if (!b) return;
    if (b.dataset.acao === "primeiro") { abreEditor(); return; }
    const id = Number(b.closest<HTMLElement>(".cartao-item")!.dataset.id);
    const i = cartoes.findIndex((c) => c.id === id);
    const c = cartoes[i];
    if (!c) return;
    const acao = b.dataset.acao!;
    if (acao === "editar") { abreEditor(c); return; }
    if (acao === "apagar" && !(await confirma(`Apagar o cartão ${c.titulo}? Não dá para desfazer.`))) return;
    const feito = acao === "ligar" ? (c.ativo ? "Desligado" : "Ligado") : FEITO[acao];
    const ok = await comCarregando(b, async () => {
      if (acao === "ligar") {
        const { id: _i, ordem: _o, ...dados } = c;
        await api("PUT", `/api/admin/cartoes/${c.id}`, { ...dados, ativo: !c.ativo });
      } else if (acao === "subir" || acao === "descer") {
        const ids = cartoes.map((x) => x.id);
        const j = acao === "subir" ? i - 1 : i + 1;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        await api("PUT", "/api/admin/cartoes/ordem", { ids });
      } else if (acao === "apagar") {
        await api("DELETE", `/api/admin/cartoes/${c.id}`);
        if (editando === c.id) fechaEditor();
      }
      aviso(`${feito}. Publicando o site…`);
      await redesenha();
    });
    // depois de redesenhar, o foco volta pro mesmo botão do mesmo cartão (quem usa teclado não se perde) e ele confirma
    const mesmo = lista.querySelector<HTMLButtonElement>(`.cartao-item[data-id="${id}"] button[data-acao="${acao}"]:not(:disabled)`);
    mesmo?.focus();
    if (ok && mesmo) marcaSalvo(mesmo, feito);
  });
}
