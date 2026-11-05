import { numeroDoZap } from "../../../lib/painel/contato.ts";
import { classesPreco, CORES_PRECO, textoPreco, ESTILO_PRECO_PADRAO, PESOS_PRECO, TAMANHOS_PRECO } from "../../../lib/painel/preco.ts";
import type { Cartao, Contato, PrecoCartao } from "../../../lib/painel/tipos.ts";
import { formataZap, LIMITES, validaCartao, validaPreco } from "../../../lib/painel/valida.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { enviaFoto } from "../foto.ts";
import { $, atualizaContadores, aviso, cabecalho, campo, comCarregando, escapa, escolheArquivo, marcaSalvo, noSite } from "../ui.ts";

const srcFoto = (chave: string) => `/api/admin/arquivos/${chave}`;

/** Pra quem vai o Zap do cartão: o escolhido, ou o geral (sem escolha ou escolha que saiu do Contato). */
function destinoZap(contato: Contato, zapId: string | null): { nome: string; numero: string; geral: boolean } {
  const numero = numeroDoZap(contato, zapId);
  const z = contato.zaps.find((x) => x.numero === numero);
  return { nome: z?.nome || "WhatsApp", numero, geral: z?.id === contato.geral };
}

type DadosCartaz = Pick<Cartao, "titulo" | "destaque" | "descricao" | "fotoChave" | "preco">;

/** O cartaz como no site (index.astro .cz); `ir` é a linha de baixo. */
const htmlCartaz = (c: DadosCartaz, cor: string, ir: string, src = c.fotoChave ? srcFoto(c.fotoChave) : null) =>
  `<div class="cz${cor}">`
  + (src ? `<img class="foto" src="${escapa(src)}" alt="" />` : "")
  + `<span class="k">${escapa(c.destaque)}</span><b>${escapa(c.titulo)}</b><p>${escapa(c.descricao)}</p>`
  + (c.preco ? `<span class="${classesPreco(c.preco)}">${escapa(textoPreco(c.preco.texto))}</span>` : "")
  + ir + `</div>`;

/** Cor da prévia: as 4 dos cartazes do site (global.css .cz:nth-child), pela posição entre os ligados. */
const corDaPosicao = (n: number) => ` c${((n - 1) % 4) + 1}`;

/**
 * Cada cartão é desenhado como no site (cartaz colorido e torto, sobre fundo preto), com os botões embaixo.
 * As cores seguem a posição entre os LIGADOS, como no site (global.css, .cz:nth-child(1..4)).
 */
function htmlLista(cartoes: Cartao[], contato: Contato): string {
  if (!cartoes.length) {
    return `<div class="vazio-bloco"><p><b>Nenhum cartão ainda.</b> Cada cartão vira um cartaz na parte "Pra sua festa" do site, com um botão que abre o seu Zap.</p>`
      + `<button class="bt" type="button" data-acao="primeiro">Criar o primeiro cartão</button></div>`;
  }
  let ligado = 0;
  return `<ol class="cartoes">` + cartoes.map((c, i) => {
    const t = escapa(c.titulo);
    const cor = c.ativo ? ` c${++ligado}` : "";
    const zap = destinoZap(contato, c.zapId);
    return `<li class="cartao-item${c.ativo ? "" : " off"}" data-id="${c.id}">`
      + htmlCartaz(c, cor, c.ativo ? `<span class="ir" aria-hidden="true">Chamar no Zap →</span>` : `<span class="ir"><span class="desligado">Desligado</span>: não aparece no site</span>`)
      + `<p class="cartao-zap"><span>Zap:</span> ${escapa(zap.nome)}${zap.geral ? " (geral)" : ""}</p>`
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

/** Opções do "WhatsApp deste cartão": o geral primeiro, depois os outros da lista do Contato (no rodapé ou não). */
function htmlEscolhaZap(contato: Contato, zapId: string | null): string {
  const geral = contato.zaps.find((z) => z.id === contato.geral);
  const opcoes = [`<option value="">Usar o geral${geral ? ` (${escapa(geral.nome)})` : ""}</option>`]
    .concat(contato.zaps.filter((z) => z.id !== contato.geral).map((z) =>
      `<option value="${z.id}"${z.id === zapId ? " selected" : ""}>${escapa(z.nome)} · ${formataZap(z.numero)}</option>`));
  return `<div class="campo"><label for="zapCartao">WhatsApp deste cartão</label>`
    + `<p class="dica" id="dica-zapCartao">Quem recebe a mensagem quando alguém toca no cartão. A lista vem da tela Contato.</p>`
    + `<div class="entrada seletor"><select id="zapCartao" name="zapCartao" aria-describedby="dica-zapCartao">${opcoes.join("")}</select></div></div>`;
}

/** Um grupo de botões de rádio do estilo do preço (cor, tamanho, grossura). */
function htmlEscolha<T extends string>(nome: string, legenda: string, lista: { valor: T; rotulo: string }[], atual: T, amostra = false): string {
  return `<fieldset class="escolha compacta"><legend>${escapa(legenda)}</legend>`
    + lista.map((i) => `<label><input type="radio" name="${nome}" value="${i.valor}"${i.valor === atual ? " checked" : ""} />`
      + (amostra ? `<span class="amostra cor-${i.valor}" aria-hidden="true"></span>` : "") + `${escapa(i.rotulo)}</label>`).join("")
    + `</fieldset>`;
}

export function montaFesta(el: HTMLElement, e: Estado) {
  let cartoes = e.cartoes;
  let contato = e.contato;
  let editando: number | null = null;
  el.innerHTML = cabecalho("Pra sua festa", "Os cartões de aluguel e serviços. Cada um abre o seu Zap.",
    `<button class="bt" type="button" id="novo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Novo cartão</button>`)
    + `<div class="festa-grade"><div id="editor"></div>${noSite(`<div id="lista">${htmlLista(cartoes, contato)}</div>`, true)}</div>`
    + `<dialog id="confirma" aria-labelledby="confirmaTexto"><p id="confirmaTexto"></p>`
    + `<div class="acoes"><button class="bt claro" type="button" value="nao">Cancelar</button><button class="bt perigo" type="button" value="sim">Apagar</button></div></dialog>`;

  const lista = $("#lista", el);
  const editor = $("#editor", el);
  const marcaEditando = () => lista.querySelectorAll<HTMLElement>(".cartao-item").forEach((li) =>
    li.classList.toggle("editando", Number(li.dataset.id) === editando));
  const redesenha = async () => {
    const novo = await carrega();
    if (novo) { cartoes = novo.cartoes; contato = novo.contato; lista.innerHTML = htmlLista(cartoes, contato); marcaEditando(); }
  };
  const fechaEditor = () => { editor.innerHTML = ""; editando = null; marcaEditando(); };

  /* ---------- editor (novo ou editar) ---------- */
  function abreEditor(c?: Cartao) {
    let fotoChave = c?.fotoChave ?? null;
    let fotoSrc = fotoChave ? srcFoto(fotoChave) : null;
    editando = c?.id ?? null;
    marcaEditando();
    const estilo = c?.preco ?? ESTILO_PRECO_PADRAO;
    // a prévia usa a cor que o cartão tem (ou vai ter) no site: a posição entre os ligados
    const ligados = cartoes.filter((x) => x.ativo);
    const posicao = c?.ativo ? ligados.findIndex((x) => x.id === c.id) + 1 : ligados.length + 1;
    editor.innerHTML = `<form class="folha editor" novalidate><h2>${c ? "Editar cartão" : "Novo cartão"}</h2>`
      + campo({ id: "titulo", rotulo: "Título", valor: c?.titulo ?? "", max: LIMITES.titulo })
      + campo({ id: "destaque", rotulo: "Destaque", valor: c?.destaque ?? "", max: LIMITES.destaque, dica: "Texto pequeno em cima do título. Opcional." })
      + campo({ id: "descricao", rotulo: "Descrição", valor: c?.descricao ?? "", max: LIMITES.descricao, multilinha: true })
      + `<div class="campo"><label for="fotoCartao">Foto (opcional)</label><p class="dica" id="dica-fotoCartao">Aparece no topo do cartão, cortada em formato de tela de TV (16:9).</p>`
      + `<div class="foto-atual">${fotoChave ? `<img class="mini16" src="${escapa(srcFoto(fotoChave))}" alt="Foto atual do cartão" />` : ""}`
      + `<p class="foto-info" aria-live="polite">${fotoChave ? "Com foto." : "Sem foto."}</p>`
      + `${fotoChave ? `<button class="bt claro pequeno-claro" type="button" id="tiraFoto">Tirar foto</button>` : ""}</div>`
      + escolheArquivo({ id: "fotoCartao", accept: "image/*", dica: "dica-fotoCartao", botao: "Escolher foto", vazio: "Nenhuma foto escolhida" }) + `</div>`
      + htmlEscolhaZap(contato, c?.zapId ?? null)
      + campo({ id: "preco", rotulo: "Preço (opcional)", valor: c?.preco?.texto ?? "", max: LIMITES.preco,
        dica: "Texto livre, ex.: a partir de R$ 350. Vazio = cartão sem preço." })
      + `<div class="preco-estilo" id="precoEstilo">`
      + htmlEscolha("precoCor", "Cor da etiqueta", CORES_PRECO, estilo.cor, true)
      + htmlEscolha("precoTamanho", "Tamanho", TAMANHOS_PRECO, estilo.tamanho)
      + htmlEscolha("precoPeso", "Grossura da letra", PESOS_PRECO, estilo.peso)
      + `</div>`
      + `<section class="previa-cartao" aria-label="Prévia do cartão"><p class="previa-rot">Prévia: assim fica no site</p>`
      + `<div class="previa-fundo" id="previaCartao"></div><p class="previa-zap" id="previaZap" aria-live="polite"></p></section>`
      + `<div class="acoes"><button class="bt" type="submit">Salvar cartão</button><button class="bt claro" type="button" id="cancela">Cancelar</button></div></form>`;
    const form = $<HTMLFormElement>("form", editor);
    const salvar = $<HTMLButtonElement>("button[type=submit]", form);
    const valor = (id: string) => $<HTMLInputElement | HTMLSelectElement>("#" + id, form).value;
    const marcado = (nome: string) => form.querySelector<HTMLInputElement>(`input[name="${nome}"]:checked`)?.value;
    const precoDigitado = () => ({ texto: valor("preco"), cor: marcado("precoCor"), tamanho: marcado("precoTamanho"), peso: marcado("precoPeso") });
    const precoDoForm = (): PrecoCartao | null => {
      const r = validaPreco(precoDigitado());
      return r.ok ? r.valor : null;
    };
    const zapDoForm = () => valor("zapCartao") || null;
    /* prévia ao vivo: o cartaz com o que está nos campos agora */
    const previa = $("#previaCartao", form), previaZap = $("#previaZap", form), estiloPreco = $("#precoEstilo", form);
    const desenhaPrevia = () => {
      estiloPreco.hidden = valor("preco").trim() === "";
      previa.innerHTML = htmlCartaz({
        titulo: valor("titulo").trim() || "Título",
        destaque: valor("destaque").trim(),
        descricao: valor("descricao").trim() || "Descrição do cartão",
        fotoChave, preco: precoDoForm(),
      }, corDaPosicao(posicao), `<span class="ir" aria-hidden="true">Chamar no Zap →</span>`, fotoSrc);
      const z = destinoZap(contato, zapDoForm());
      // o número não quebra no meio
      previaZap.innerHTML = `Abre o ${escapa(z.nome)}${z.geral ? " (geral)" : ""} · <span class="sem-quebra">${formataZap(z.numero)}</span>`;
    };
    const confere = () => { salvar.disabled = !atualizaContadores(form); };
    form.addEventListener("input", () => { confere(); desenhaPrevia(); });
    form.addEventListener("change", desenhaPrevia);
    confere();
    desenhaPrevia();
    $<HTMLInputElement>("#titulo", form).focus();
    $("#cancela", form).addEventListener("click", fechaEditor);
    form.querySelector("#tiraFoto")?.addEventListener("click", () => {
      fotoChave = null;
      fotoSrc = null;
      desenhaPrevia();
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
        fotoSrc = nova.src;
        desenhaPrevia();
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
      const r = validaCartao({
        titulo: valor("titulo"), destaque: valor("destaque"), descricao: valor("descricao"), ativo: c?.ativo ?? true, fotoChave,
        zapId: zapDoForm(), preco: precoDigitado(),
      });
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
