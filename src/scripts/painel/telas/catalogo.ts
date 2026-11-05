import type { Previa } from "../../../lib/xlsx.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { quando } from "../status.ts";
import { validaDicas } from "../../../lib/painel/valida.ts";
import { $, aviso, cabecalho, campo, comanda, comCarregando, erroNoCampo, escapa, limpaErros, linhaComanda, numero as n } from "../ui.ts";

/** O catálogo que está no ar, em forma de comanda. */
function fonteAtual(e: Estado): string {
  const c = e.catalogo;
  const noAr = e.musicasNoAr !== null ? linhaComanda("Músicas no ar", n(e.musicasNoAr)) : "";
  if (c.fonte === "arquivo" && c.arquivo) {
    return comanda("Catálogo no ar", "arquivo .xlsx", linhaComanda("Arquivo", escapa(c.arquivo.nome))
      + linhaComanda("Enviado", escapa(quando(c.arquivo.enviadoEm, new Date()))) + noAr + linhaComanda("Pacotes", n(c.arquivo.pacotes)),
    "O site só muda quando você enviar outro arquivo.");
  }
  return comanda("Catálogo no ar", "planilha do Google", linhaComanda("Fonte", `<a href="${escapa(c.link ?? "")}" target="_blank" rel="noopener">abrir planilha</a>`) + noAr,
    `A planilha é conferida todo dia às 06:17. Mudou agora? Toque em "Atualizar catálogo".`);
}

function htmlPrevia(p: Previa, noAr: number | null): string {
  return comanda("Prévia do arquivo", "ainda não publicado", linhaComanda("Músicas", n(p.musicas)) + linhaComanda("Pacotes", n(p.pacotes))
      + linhaComanda("Pacotes novos", n(p.novos.length)) + linhaComanda("Linhas ignoradas", n(p.ignoradas)),
    "Linhas ignoradas: sem código ou título, repetidas ou marcadas como duplicado.")
    + (p.novos.length
      ? `<p>Pacotes novos, que entram como Novidade: <b>${p.novos.map(escapa).join(", ")}</b>.</p>`
      : `<p>Nenhum pacote novo.</p>`)
    + (p.abaixoDaMetade
      ? `<div class="alerta"><p>Esse arquivo tem ${n(p.musicas)} músicas, menos da metade das ${n(noAr ?? 0)} que estão no ar. Confere se é o arquivo certo.</p>`
        + `<label class="marcar"><input type="checkbox" id="forcar" /> Sim, o catálogo novo tem menos músicas mesmo</label></div>`
      : "");
}

export function montaCatalogo(el: HTMLElement, e: Estado) {
  const ehLink = e.catalogo.fonte === "link";
  el.innerHTML = cabecalho("Catálogo", "De onde vêm as músicas do site.")
    + `<div class="duas esq-estreita"><div class="coluna">${fonteAtual(e)}`
    + (ehLink ? `<div class="acoes"><button class="bt claro" type="button" id="atualizar">Atualizar catálogo</button></div>` : "")
    // "Tenta aí" do site: sugestões sorteadas do catálogo embaixo da busca
    + `<form class="folha" id="formDicas" novalidate><h2>Tenta aí</h2>`
    + `<p>Embaixo da busca do site aparecem sugestões sorteadas do catálogo: um código, um cantor, uma música e uma novidade. Elas trocam sozinhas.</p>`
    + campo({ id: "segundos", rotulo: "Trocar a cada (segundos)", valor: String(e.dicas.segundos).replace(".", ","), inputmode: "decimal",
      dica: "De 2 a 15. O normal é 4." })
    + `<div class="acoes"><button class="bt" type="submit">Salvar tempo</button></div></form>`
    + `</div><div class="coluna"><fieldset class="escolha"><legend>Trocar a fonte</legend>`
    + `<label><input type="radio" name="fonte" value="arquivo" ${ehLink ? "" : "checked"} /> <span>Arquivo .xlsx</span></label>`
    + `<label><input type="radio" name="fonte" value="link" ${ehLink ? "checked" : ""} /> <span>Link do Google</span></label></fieldset>`
    // arquivo
    + `<section class="folha" data-fonte="arquivo"><h2>Enviar planilha</h2>`
    + `<div class="campo"><label for="arquivo">Escolha o arquivo</label><p class="dica" id="dica-arquivo">A planilha precisa ter a aba "Músicas" com as colunas codigo, cantor, titulo e pacote.</p>`
    + `<input type="file" id="arquivo" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="dica-arquivo" /></div>`
    + `<div class="previa" aria-live="polite"><p class="vazio">Escolha um arquivo pra ver quantas músicas ele tem antes de publicar.</p></div>`
    + `<div class="acoes"><button class="bt" type="button" id="confirmar" disabled>Confirmar e publicar</button></div></section>`
    // link
    + `<section class="folha" data-fonte="link"><h2>Planilha do Google</h2>`
    + campo({ id: "link", rotulo: "Link da planilha", valor: e.catalogo.link ?? "", inputmode: "url",
      dica: "No Google Sheets: Compartilhar → qualquer pessoa com o link pode ver. Copie o endereço e cole aqui." })
    + `<p class="teste-link" aria-live="polite"></p>`
    + `<div class="acoes"><button class="bt claro" type="button" id="testar">Testar</button><button class="bt" type="button" id="salvarLink" disabled>Salvar link</button></div></section></div></div>`;

  const fonte = () => $<HTMLInputElement>("input[name=fonte]:checked", el).value;
  const mostraFonte = () => el.querySelectorAll<HTMLElement>("[data-fonte]").forEach((s) => (s.hidden = s.dataset.fonte !== fonte()));
  el.querySelectorAll("input[name=fonte]").forEach((r) => r.addEventListener("change", mostraFonte));
  mostraFonte();

  const recarregaTela = async () => { const novo = await carrega(); if (novo) montaCatalogo(el, novo); };

  el.querySelector<HTMLButtonElement>("#atualizar")?.addEventListener("click", (ev) =>
    comCarregando(ev.currentTarget as HTMLButtonElement, async () => {
      await api("POST", "/api/admin/publicar", { motivo: "atualizar-catalogo" });
      aviso("Pedido feito. Publicando com a planilha de agora…");
      await carrega();
    }));

  /* ---------- Tenta aí: tempo da troca ---------- */
  const formDicas = $<HTMLFormElement>("#formDicas", el);
  formDicas.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    limpaErros(formDicas);
    const bruto = $<HTMLInputElement>("#segundos", formDicas).value.trim().replace(",", ".");
    const r = validaDicas({ segundos: bruto === "" ? NaN : Number(bruto) });
    if (!r.ok) { erroNoCampo(formDicas, "segundos", r.erro); return; }
    await comCarregando($<HTMLButtonElement>("button[type=submit]", formDicas), async () => {
      await api("PUT", "/api/admin/dicas", r.valor);
      aviso("Salvo. Publicando o site…");
      await carrega();
    }, "Salvo");
  });

  /* ---------- arquivo: prévia no navegador, confirma, envia ---------- */
  const entrada = $<HTMLInputElement>("#arquivo", el);
  const previa = $(".previa", el);
  const confirmar = $<HTMLButtonElement>("#confirmar", el);
  let lida: { arquivo: File; previa: Previa } | null = null;

  const podeConfirmar = () => {
    const forcar = el.querySelector<HTMLInputElement>("#forcar");
    confirmar.disabled = !lida || (lida.previa.abaixoDaMetade && !forcar?.checked);
  };

  entrada.addEventListener("change", async () => {
    lida = null;
    podeConfirmar();
    const arquivo = entrada.files?.[0];
    if (!arquivo) { previa.innerHTML = `<p class="vazio">Escolha um arquivo pra ver quantas músicas ele tem antes de publicar.</p>`; return; }
    previa.innerHTML = `<p class="carregando">Lendo a planilha…</p>`;
    try {
      // o SheetJS só carrega quando o Ari escolhe um arquivo
      const { lerAbaMusicas, previaPlanilha } = await import("../../../lib/xlsx.ts");
      const linhas = lerAbaMusicas(await arquivo.arrayBuffer());
      const p = previaPlanilha(linhas, e.pacotes.map((x) => x.nome), e.musicasNoAr);
      if (p.musicas === 0) throw new Error("Nenhuma música com código e título nessa planilha.");
      lida = { arquivo, previa: p };
      previa.innerHTML = htmlPrevia(p, e.musicasNoAr);
      el.querySelector("#forcar")?.addEventListener("change", podeConfirmar);
    } catch (erro) {
      previa.innerHTML = `<p class="erro-bloco">${escapa((erro as Error).message)}</p>`;
    }
    podeConfirmar();
  });

  confirmar.addEventListener("click", () => comCarregando(confirmar, async () => {
    if (!lida) return;
    const form = new FormData();
    form.set("tipo", "planilha");
    form.set("arquivo", lida.arquivo);
    const { chave } = await api<{ chave: string }>("POST", "/api/admin/arquivos", form);
    const forcar = el.querySelector<HTMLInputElement>("#forcar")?.checked === true;
    await api("PUT", "/api/admin/catalogo", {
      fonte: "arquivo",
      arquivo: { chave, nome: lida.arquivo.name, musicas: lida.previa.musicas, pacotes: lida.previa.pacotes, ...(forcar ? { forcar } : {}) },
    });
    aviso("Salvo. Publicando o site…");
    await recarregaTela();
  }));

  /* ---------- link: testa antes de salvar ---------- */
  const link = $<HTMLInputElement>("#link", el);
  const resultado = $(".teste-link", el);
  const salvarLink = $<HTMLButtonElement>("#salvarLink", el);
  let testado = "";
  link.addEventListener("input", () => {
    salvarLink.disabled = link.value.trim() !== testado;
    if (salvarLink.disabled) resultado.textContent = "";
  });
  $<HTMLButtonElement>("#testar", el).addEventListener("click", (ev) => comCarregando(ev.currentTarget as HTMLButtonElement, async () => {
    const url = link.value.trim();
    resultado.textContent = "Testando…";
    resultado.dataset.tipo = "";
    try {
      await api("GET", "/api/admin/link/teste?url=" + encodeURIComponent(url));
      testado = url;
      resultado.textContent = "✅ Planilha pública, com as colunas certas.";
      resultado.dataset.tipo = "ok";
    } catch (erro) {
      testado = "";
      resultado.textContent = (erro as Error).message;
      resultado.dataset.tipo = "erro";
    }
    salvarLink.disabled = url !== testado;
  }));
  salvarLink.addEventListener("click", () => comCarregando(salvarLink, async () => {
    await api("PUT", "/api/admin/catalogo", { fonte: "link", link: testado });
    aviso("Salvo. Publicando o site…");
    await recarregaTela();
  }));
}
