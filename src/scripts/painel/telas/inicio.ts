import { formataZap } from "../../../lib/painel/valida.ts";
import { carrega, type Estado } from "../estado.ts";
import { MOTIVOS, quando, textoStatus, type TipoStatus } from "../status.ts";
import { comanda, escapa, linhaComanda, numero } from "../ui.ts";

/** Frase grande do topo, no jeito do letreiro do site: palavra cheia, palavra vazada, fim em itálico amarelo. */
const LETREIRO: Record<TipoStatus, [string, string, string]> = {
  ok: ["O site ", "está", "no ar."],
  nenhuma: ["O site ", "está", "no ar."],
  publicando: ["", "Publicando", "o site…"],
  demorando: ["Está ", "demorando.", "Avisa o Gabriel."],
  falhou: ["Não ", "publicou.", "O site segue igual."],
};

const ICONES: Record<string, string> = {
  catalogo: '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  novidades: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  banner: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>',
  festa: '<path d="M4 21 9 6l9 9z"/><path d="M14 3c0 2 2 2 2 4M19 8c1 0 2-1 2-2M17 12c1.5 0 3 .5 4 2"/>',
  contato: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
};

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;

/** Cada atalho mostra o dado de agora daquela tela. */
function atalhos(e: Estado): [string, string, string][] {
  const novas = e.pacotes.filter((p) => p.classe === "nova").length;
  const ligados = e.cartoes.filter((c) => c.ativo).length;
  const fonte = e.catalogo.fonte === "arquivo" && e.catalogo.arquivo ? `Arquivo ${e.catalogo.arquivo.nome}` : "Planilha do Google";
  return [
    ["catalogo", "Catálogo", e.musicasNoAr !== null ? `${fonte}, ${plural(e.musicasNoAr, "música", "músicas")}` : fonte],
    ["novidades", "Novidades", novas ? `${plural(novas, "pacote", "pacotes")} com a etiqueta nova` : "Nenhum pacote com a etiqueta nova"],
    ["banner", "Banner", `“${e.banner.linhas.join(" ").replace(/\s+/g, " ").trim()}”`],
    ["festa", "Pra sua festa", e.cartoes.length ? `${plural(ligados, "cartão ligado", "cartões ligados")} de ${numero(e.cartoes.length)}` : "Nenhum cartão ainda"],
    ["contato", "Contato", `Zap ${formataZap(e.contato.zapContato)}`],
  ];
}

const hoje = (agora: Date) => agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" });
const SIMBOLO: Record<string, string> = { ok: "✅", falhou: "❌", pendente: "⏳", rodando: "⏳" };

export function montaInicio(el: HTMLElement, e: Estado) {
  const agora = new Date();
  const p = e.publicacao;
  const { tipo } = textoStatus(p, agora);
  const [cheia, vazada, fim] = LETREIRO[tipo];
  const ultima = p
    ? `Última mudança: <b>${escapa(MOTIVOS[p.motivo] ?? p.motivo)}</b>, pedida ${escapa(quando(p.pedidoEm, agora).includes("às") ? "em " : "às ")}${escapa(quando(p.pedidoEm, agora))}.`
    : "Nada foi mudado pelo painel ainda. O site está como antes.";
  const detalhe = tipo === "falhou" ? ` ${escapa(p?.erro ?? "")}` : " Tudo o que você salva aqui vai pro site em uns 2 minutos.";

  const novas = e.pacotes.filter((x) => x.classe === "nova").length;
  const exc = e.pacotes.filter((x) => x.classe === "exc").length;
  const ligados = e.cartoes.filter((c) => c.ativo).length;
  const linhas = (e.musicasNoAr !== null ? linhaComanda("Músicas no ar", numero(e.musicasNoAr)) : "")
    + linhaComanda("Pacotes como novidade", numero(novas))
    + linhaComanda("Pacotes só no Ari", numero(exc))
    + linhaComanda("Cartões de festa ligados", `${numero(ligados)}<small>de</small>${numero(e.cartoes.length)}`);
  const historico = e.historico.length
    ? `<p class="comanda-tit">Últimas publicações</p><ul class="historico">`
      + e.historico.map((h) => `<li><span>${escapa(MOTIVOS[h.motivo] ?? h.motivo)}</span><span class="pontos" aria-hidden="true"></span>`
        + `<span class="quando">${escapa(quando(h.terminouEm ?? h.pedidoEm, agora))} <span role="img" aria-label="${escapa(h.status === "ok" ? "no ar" : h.status === "falhou" ? "falhou" : "publicando")}">${SIMBOLO[h.status]}</span></span></li>`).join("")
      + `</ul>`
    : `<p class="comanda-nota">A planilha do Google é conferida todo dia às 06:17.</p>`;

  el.innerHTML = `<div class="inicio">`
    + `<section class="cartaz-status" data-tipo="${tipo}">`
    + `<span class="bola" aria-hidden="true"></span>`
    + `<h1><span class="cheia">${escapa(cheia)}</span><span class="vazada">${escapa(vazada)}</span> <span class="fim">${escapa(fim)}</span></h1>`
    + `<p>${ultima}${detalhe}</p>`
    + `<div class="acoes"><a class="bt" href="/" target="_blank" rel="noopener">Ver o site</a>`
    + `<button class="bt claro" type="button" data-recarrega>Atualizar status</button></div></section>`
    + comanda("Comanda de hoje", hoje(agora), linhas, historico)
    + `<nav class="atalhos" aria-label="Atalhos">`
    + atalhos(e).map(([id, nome, desc]) => `<a href="#${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[id]}</svg>`
      + `<span><b>${escapa(nome)}</b><span>${escapa(desc)}</span></span></a>`).join("")
    + `</nav></div>`;
  el.querySelector<HTMLButtonElement>("[data-recarrega]")!.addEventListener("click", async (ev) => {
    const b = ev.currentTarget as HTMLButtonElement;
    b.setAttribute("aria-busy", "true");
    b.disabled = true;
    await carrega();
  });
}
