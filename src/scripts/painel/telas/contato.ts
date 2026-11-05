import { blocosRodape, REDES } from "../../../lib/painel/contato.ts";
import type { Contato, PerfilRede, Rede, ZapNomeado } from "../../../lib/painel/tipos.ts";
import {
  campoDoErro, LIMITE_NOME_ZAP, MAX_REDES, MAX_ZAPS, mascaraZap, normalizaUsuario, validaContato,
} from "../../../lib/painel/valida.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { $, atualizaContadores, aviso, cabecalho, campo, comCarregando, erroNoCampo, escapa, limpaErros, noSite } from "../ui.ts";

/** O que está nos campos agora: números como o Ari digitou, ainda sem validar. */
type Rascunho = Contato;

const hojeSP = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
let seq = 0;
const novoId = (letra: string) => letra + Date.now().toString(36) + (seq++).toString(36);

/* ---------- máscara do telefone ---------- */
const digitos = (s: string) => s.replace(/\D/g, "");

/**
 * Formata enquanto digita, sem pular o cursor. Backspace logo depois de um separador ("-", ") ")
 * apaga o dígito antes dele, como a pessoa espera.
 */
function mascara(i: HTMLInputElement, ev: Event) {
  const tipo = (ev as InputEvent).inputType ?? "";
  const anterior = i.dataset.anterior ?? "";
  let valor = i.value;
  let pos = i.selectionStart ?? valor.length;
  let antes = digitos(valor.slice(0, pos)).length;
  if (tipo === "deleteContentBackward" && digitos(valor) === digitos(anterior) && antes > 0) {
    const d = digitos(valor);
    valor = d.slice(0, antes - 1) + d.slice(antes);
    antes -= 1;
  }
  const novo = mascaraZap(valor);
  i.value = novo;
  i.dataset.anterior = novo;
  if (tipo.startsWith("insertFromPaste") || document.activeElement !== i) return;
  // cursor logo depois do mesmo número de dígitos
  pos = 0;
  for (let n = 0; pos < novo.length && n < antes; pos++) if (/\d/.test(novo[pos])) n++;
  if (antes === 0) pos = novo.startsWith("(") ? 1 : 0;
  i.setSelectionRange(pos, pos);
}

/* ---------- desenho ---------- */
/** `verbo` + nome do item = o que o leitor de tela fala ("Subir WhatsApp - Ana Paula"); muda junto com o nome. */
const mini = (acao: string, verbo: string, nome: string, texto: string, extra = "") =>
  `<button class="mini" type="button" data-acao="${acao}" data-verbo="${verbo}" aria-label="${verbo} ${nome}"${extra}>${texto}</button>`;

function htmlZap(z: ZapNomeado, i: number, r: Rascunho): string {
  const geral = z.id === r.geral;
  const nome = escapa(z.nome.trim() || `WhatsApp ${i + 1}`);
  return `<li class="zap-item${geral ? " geral" : ""}${z.ativo || geral ? "" : " fora"}" data-id="${z.id}">`
    + `<fieldset><legend><span class="zap-n">${i + 1}</span><span class="zap-tit">${nome}</span>`
    + (geral ? `<span class="selo">Geral</span>` : z.ativo ? "" : `<span class="selo apagado">Fora do rodapé</span>`) + `</legend>`
    + campo({ id: `zap-nome-${z.id}`, rotulo: "Nome no rodapé", valor: z.nome, max: LIMITE_NOME_ZAP })
    + campo({ id: `zap-numero-${z.id}`, rotulo: "Número", valor: mascaraZap(z.numero),
      tipo: "tel", inputmode: "tel", autocomplete: geral ? "tel" : "off" })
    + `<div class="zap-opcoes">`
    + `<label class="marcar"><input type="radio" name="geral" value="${z.id}"${geral ? " checked" : ""} /> É o geral</label>`
    + `<label class="marcar"><input type="checkbox" data-campo="ativo"${z.ativo || geral ? " checked" : ""}${geral ? " disabled" : ""} /> Mostrar no rodapé</label>`
    + `</div>`
    + `<div class="item-acoes">`
    + mini("subir", "Subir", nome, "↑", i === 0 ? " disabled" : "")
    + mini("descer", "Descer", nome, "↓", i === r.zaps.length - 1 ? " disabled" : "")
    + mini("remover-zap", "Remover", nome, "Remover", geral ? ` disabled title="O geral não pode ser removido. Escolha outro geral antes."` : "")
    + `</div></fieldset></li>`;
}

function htmlDestino(id: "kj" | "pedido", rotulo: string, dica: string, r: Rascunho): string {
  const geral = r.zaps.find((z) => z.id === r.geral);
  const opcoes = [`<option value="">Usar o geral${geral?.nome ? ` (${escapa(geral.nome)})` : ""}</option>`]
    .concat(r.zaps.filter((z) => z.id !== r.geral).map((z) =>
      `<option value="${z.id}"${r[id] === z.id ? " selected" : ""}>${escapa(z.nome || "Sem nome")}</option>`));
  return `<div class="campo"><label for="${id}">${escapa(rotulo)}</label><p class="dica" id="dica-${id}">${escapa(dica)}</p>`
    + `<div class="entrada seletor"><select id="${id}" name="${id}" aria-describedby="dica-${id} erro-${id}">${opcoes.join("")}</select></div>`
    + `<p class="erro" id="erro-${id}" aria-live="polite"></p></div>`;
}

function htmlRedes(r: Rascunho): string {
  return REDES.map((info) => {
    const perfis = r.redes.filter((p) => p.rede === info.rede);
    return `<div class="rede-grupo" data-rede="${info.rede}"><h3>${escapa(info.rotulo)}</h3>`
      + (perfis.length ? `<ul class="perfis">` + perfis.map((p, i) => {
        const qual = `${info.rotulo}${perfis.length > 1 ? ` ${i + 1}` : ""}`;
        return `<li class="perfil${p.ativo ? "" : " fora"}" data-id="${p.id}">`
          + campo({ id: `rede-${p.id}`, rotulo: `Usuário do ${qual}`, valor: p.usuario, prefixo: info.prefixo })
          + `<div class="perfil-acoes"><label class="marcar"><input type="checkbox" data-campo="ativo"${p.ativo ? " checked" : ""} /> Mostrar no rodapé</label>`
          + mini("remover-rede", "Remover", escapa(qual), "Remover") + `</div></li>`;
      }).join("") + `</ul>` : "")
      + `<button class="bt claro pequeno-claro" type="button" data-acao="nova-rede" data-rede="${info.rede}">`
      + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>${perfis.length ? "Outro" : "Adicionar"} ${escapa(info.rotulo)}</button></div>`;
  }).join("");
}

/** Rodapé do site (index.astro, footer#contato) com o que está nos campos agora. Campo ainda inválido: mostra como está escrito. */
function rodape(r: Rascunho): string {
  const previa: Contato = {
    ...r,
    zaps: r.zaps.map((z) => ({ ...z, nome: z.nome || "WhatsApp", numero: mascaraZap(z.numero) || "—", ativo: z.ativo || z.id === r.geral })),
    redes: r.redes.filter((p) => p.usuario.trim()).map((p) => {
      const u = normalizaUsuario(p.usuario);
      return { ...p, usuario: u.ok ? u.valor : p.usuario.trim() };
    }),
  };
  const blocos = blocosRodape(previa, (n) => n).map((b) => `<div><small>${escapa(b.rotulo)}</small>`
    + b.itens.map((it) => `<span class="${it.zap ? "num" : "lk"}">${escapa(it.texto)}</span>`).join("") + `</div>`);
  return `<div class="rodape-site"><p class="wordmark">Ari Ribeiro <em>karaokê</em></p><div class="contatos">`
    + blocos.join("") + `<div><small>Catálogo</small>Atualizado em ${hojeSP()}</div></div></div>`;
}

export function montaContato(el: HTMLElement, e: Estado) {
  // o que vai pro servidor é o que está nos campos (o servidor normaliza os números)
  const r: Rascunho = structuredClone(e.contato);

  el.innerHTML = cabecalho("Contato", "Os WhatsApp e as redes que aparecem no rodapé do site.")
    + `<div class="duas"><form class="contato-form" novalidate>`
    + `<section class="folha" aria-labelledby="titZaps"><h2 id="titZaps">WhatsApp</h2>`
    + `<p class="dica-folha">Cada um vira um bloco no rodapé, nesta ordem. O <b>geral</b> é o padrão de todos os botões do site e sempre aparece.</p>`
    + `<ol class="zaps" id="zaps"></ol>`
    + `<button class="bt claro" type="button" data-acao="novo-zap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar WhatsApp</button>`
    + `<p class="erro-bloco" id="erroZaps" role="alert" hidden></p></section>`
    + `<section class="folha" aria-labelledby="titDestinos"><h2 id="titDestinos">Quem recebe</h2><div id="destinos"></div></section>`
    + `<section class="folha" aria-labelledby="titRedes"><h2 id="titRedes">Redes sociais</h2>`
    + `<p class="dica-folha">Cada rede vira um bloco no rodapé. Desligue pra esconder sem apagar.</p><div id="redes"></div></section>`
    + `<div class="acoes salvar"><button class="bt" type="submit">Salvar contato</button></div></form>`
    + noSite(`<div id="previaRodape"></div><p class="no-site-nota">A prévia muda enquanto você digita. Nada vai pro site até você salvar.</p>`)
    + `</div>`;

  const form = $<HTMLFormElement>("form", el);
  const lista = $("#zaps", el), destinos = $("#destinos", el), redes = $("#redes", el), previa = $("#previaRodape", el);

  /** Campos → rascunho (a ordem e o que existe já estão no rascunho). */
  const le = () => {
    for (const z of r.zaps) {
      const li = $(`.zap-item[data-id="${z.id}"]`, lista);
      z.nome = $<HTMLInputElement>(`#zap-nome-${z.id}`, li).value;
      z.numero = $<HTMLInputElement>(`#zap-numero-${z.id}`, li).value;
      z.ativo = $<HTMLInputElement>("[data-campo=ativo]", li).checked;
    }
    r.kj = $<HTMLSelectElement>("#kj", destinos).value || null;
    r.pedido = $<HTMLSelectElement>("#pedido", destinos).value || null;
    for (const p of r.redes) {
      const li = $(`.perfil[data-id="${p.id}"]`, redes);
      p.usuario = $<HTMLInputElement>(`#rede-${p.id}`, li).value;
      p.ativo = $<HTMLInputElement>("[data-campo=ativo]", li).checked;
    }
  };
  const desenhaDestinos = () => {
    destinos.innerHTML = htmlDestino("kj", "Zap do KJ (comanda)", "Recebe a comanda com as músicas. Não precisa estar no rodapé.", r)
      + htmlDestino("pedido", "Zap do “Pedir música nova”", "O botão que aparece quando a busca não acha a música.", r);
  };
  const desenhaPrevia = () => { previa.innerHTML = rodape(r); };
  /** Mudou a estrutura (novo, remover, ordem, geral): redesenha as listas. */
  const desenha = () => {
    lista.innerHTML = r.zaps.map((z, i) => htmlZap(z, i, r)).join("");
    lista.querySelectorAll<HTMLInputElement>("input[type=tel]").forEach((i) => (i.dataset.anterior = i.value));
    redes.innerHTML = htmlRedes(r);
    desenhaDestinos();
    atualizaContadores(form);
    $<HTMLButtonElement>("[data-acao=novo-zap]", form).disabled = r.zaps.length >= MAX_ZAPS;
    form.querySelectorAll<HTMLButtonElement>("[data-acao=nova-rede]").forEach((b) => (b.disabled = r.redes.length >= MAX_REDES));
    desenhaPrevia();
  };
  desenha();

  form.addEventListener("input", (ev) => {
    const alvo = ev.target as HTMLInputElement;
    if (alvo.type === "tel") mascara(alvo, ev);
    if (alvo.getAttribute("aria-invalid")) erroNoCampo(form, alvo.id, null);
    le();
    atualizaContadores(form);
    if (alvo.id.startsWith("zap-nome-")) {
      // o nome aparece no título do item e nas escolhas de "Quem recebe"
      const z = r.zaps.find((x) => alvo.id === `zap-nome-${x.id}`)!;
      const li = alvo.closest("li")!, nome = z.nome.trim() || `WhatsApp ${r.zaps.indexOf(z) + 1}`;
      $(".zap-tit", li).textContent = nome;
      li.querySelectorAll<HTMLElement>("[data-verbo]").forEach((b) => b.setAttribute("aria-label", `${b.dataset.verbo} ${nome}`));
      desenhaDestinos();
    }
    desenhaPrevia();
  });

  form.addEventListener("change", (ev) => {
    const alvo = ev.target as HTMLInputElement;
    le();
    if (alvo.name === "geral") {
      r.geral = alvo.value;
      if (r.kj === r.geral) r.kj = null;
      if (r.pedido === r.geral) r.pedido = null;
      desenha();
      $<HTMLInputElement>(`input[name=geral][value="${r.geral}"]`, lista).focus();
    } else if (alvo.dataset.campo === "ativo") {
      alvo.closest("li")!.classList.toggle("fora", !alvo.checked);
      const selo = alvo.closest(".zap-item")?.querySelector("legend");
      if (selo && !alvo.closest(".geral")) {
        selo.querySelector(".selo")?.remove();
        if (!alvo.checked) selo.insertAdjacentHTML("beforeend", `<span class="selo apagado">Fora do rodapé</span>`);
      }
      desenhaPrevia();
    }
  });

  form.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button[data-acao]");
    if (!b || b.disabled) return;
    le();
    const id = b.closest<HTMLElement>("li")?.dataset.id;
    const acao = b.dataset.acao;
    let foco = "";
    if (acao === "novo-zap") {
      const z: ZapNomeado = { id: novoId("z"), nome: "", numero: "", ativo: true };
      r.zaps.push(z);
      foco = `#zap-nome-${z.id}`;
    } else if (acao === "subir" || acao === "descer") {
      const i = r.zaps.findIndex((z) => z.id === id), j = acao === "subir" ? i - 1 : i + 1;
      [r.zaps[i], r.zaps[j]] = [r.zaps[j], r.zaps[i]];
      // o foco fica no mesmo botão; se ele travou (chegou na ponta), vai pro outro
      foco = `.zap-item[data-id="${id}"] [data-acao=${(acao === "subir" ? j === 0 : j === r.zaps.length - 1) ? (acao === "subir" ? "descer" : "subir") : acao}]`;
    } else if (acao === "remover-zap") {
      const i = r.zaps.findIndex((z) => z.id === id);
      r.zaps.splice(i, 1);
      if (r.kj === id) r.kj = null;
      if (r.pedido === id) r.pedido = null;
      foco = r.zaps[Math.min(i, r.zaps.length - 1)] ? `#zap-nome-${r.zaps[Math.min(i, r.zaps.length - 1)].id}` : "[data-acao=novo-zap]";
    } else if (acao === "nova-rede") {
      const p: PerfilRede = { id: novoId("r"), rede: b.dataset.rede as Rede, usuario: "", ativo: true };
      // entra depois dos outros perfis da mesma rede
      const ultimo = r.redes.map((x) => x.rede).lastIndexOf(p.rede);
      r.redes.splice(ultimo < 0 ? r.redes.length : ultimo + 1, 0, p);
      foco = `#rede-${p.id}`;
    } else if (acao === "remover-rede") {
      const p = r.redes.find((x) => x.id === id)!;
      r.redes.splice(r.redes.indexOf(p), 1);
      foco = `[data-acao=nova-rede][data-rede=${p.rede}]`;
    } else return;
    desenha();
    const alvo = form.querySelector<HTMLElement>(foco);
    // item novo entra subindo; o que trocou de lugar pisca de leve (CSS: .novo / .mexeu)
    if (acao === "novo-zap" || acao === "nova-rede") alvo?.closest("li")?.classList.add("novo");
    if (acao === "subir" || acao === "descer") form.querySelector(`.zap-item[data-id="${id}"]`)?.classList.add("mexeu");
    alvo?.focus();
  });

  /** Mensagem no campo certo; sem campo (lista errada), no fim da lista de WhatsApp. */
  const mostraErro = (erro: string) => {
    const { campo: id, mensagem } = campoDoErro(erro);
    const alvo = id ? form.querySelector<HTMLElement>("#" + id) : null;
    if (!alvo) {
      const p = $("#erroZaps", form);
      p.textContent = mensagem;
      p.hidden = false;
      return;
    }
    erroNoCampo(form, id!, mensagem);
    alvo.focus();
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    limpaErros(form);
    $("#erroZaps", form).hidden = true;
    le();
    const v = validaContato(r);
    if (!v.ok) return mostraErro(v.erro);
    await comCarregando($<HTMLButtonElement>("button[type=submit]", form), async () => {
      await api("PUT", "/api/admin/contato", r);
      aviso("Salvo. Publicando o site…");
      await carrega();
    }, "Salvo");
  });
}
