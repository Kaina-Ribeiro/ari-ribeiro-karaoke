import type { Previa } from "../../../lib/xlsx.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { quando } from "../status.ts";
import { $, aviso, cabecalho, campo, comCarregando, escapa } from "../ui.ts";

const n = (x: number) => x.toLocaleString("pt-BR");

function fonteAtual(e: Estado): string {
  const c = e.catalogo;
  if (c.fonte === "arquivo" && c.arquivo) {
    return `Hoje o site usa o arquivo <b>${escapa(c.arquivo.nome)}</b>, enviado ${escapa(quando(c.arquivo.enviadoEm, new Date()))}, com ${n(c.arquivo.musicas)} músicas.`;
  }
  return `Hoje o site lê a planilha do Google: <a href="${escapa(c.link ?? "")}" target="_blank" rel="noopener">abrir planilha</a>. Ela é conferida todo dia de manhã.`;
}

function htmlPrevia(p: Previa, noAr: number | null): string {
  return `<ul class="numeros">`
    + `<li><b>${n(p.musicas)}</b> músicas</li>`
    + `<li><b>${n(p.pacotes)}</b> pacotes</li>`
    + `<li><b>${n(p.ignoradas)}</b> linhas ignoradas <span>(sem código ou título, repetidas ou marcadas como duplicado)</span></li></ul>`
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
    + `<section class="folha"><p>${fonteAtual(e)}</p>`
    + (ehLink ? `<div class="acoes"><button class="bt claro" type="button" id="atualizar">Atualizar catálogo</button></div>` : "")
    + `</section>`
    + `<fieldset class="escolha"><legend>Trocar a fonte</legend>`
    + `<label><input type="radio" name="fonte" value="arquivo" ${ehLink ? "" : "checked"} /> <span>Arquivo .xlsx</span></label>`
    + `<label><input type="radio" name="fonte" value="link" ${ehLink ? "checked" : ""} /> <span>Link do Google</span></label></fieldset>`
    // arquivo
    + `<section class="folha" data-fonte="arquivo"><h2>Enviar planilha</h2>`
    + `<div class="campo"><label for="arquivo">Escolha o arquivo</label><p class="dica" id="dica-arquivo">A planilha precisa ter a aba "Músicas" com as colunas codigo, cantor, titulo e pacote.</p>`
    + `<input type="file" id="arquivo" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-describedby="dica-arquivo" /></div>`
    + `<div class="previa" aria-live="polite"></div>`
    + `<div class="acoes"><button class="bt" type="button" id="confirmar" disabled>Confirmar e publicar</button></div></section>`
    // link
    + `<section class="folha" data-fonte="link"><h2>Planilha do Google</h2>`
    + campo({ id: "link", rotulo: "Link da planilha", valor: e.catalogo.link ?? "", inputmode: "url",
      dica: "No Google Sheets: Compartilhar → qualquer pessoa com o link pode ver. Copie o endereço e cole aqui." })
    + `<p class="teste-link" aria-live="polite"></p>`
    + `<div class="acoes"><button class="bt claro" type="button" id="testar">Testar</button><button class="bt" type="button" id="salvarLink" disabled>Salvar link</button></div></section>`;

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
    if (!arquivo) { previa.innerHTML = ""; return; }
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
