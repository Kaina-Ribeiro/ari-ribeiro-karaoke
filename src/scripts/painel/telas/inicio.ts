import { carrega, type Estado } from "../estado.ts";
import { MOTIVOS, quando } from "../status.ts";
import { cabecalho, escapa } from "../ui.ts";

const ATALHOS: [string, string, string][] = [
  ["catalogo", "Catálogo", "Trocar a planilha de músicas"],
  ["novidades", "Novidades", "O que aparece como nova e só no Ari"],
  ["banner", "Banner", "A frase grande e a foto do topo"],
  ["festa", "Pra sua festa", "Cartões de aluguel e serviços"],
  ["contato", "Contato", "Zap e redes sociais"],
];

export function montaInicio(el: HTMLElement, e: Estado) {
  const p = e.publicacao;
  const agora = new Date();
  const q = p ? quando(p.pedidoEm, agora) : "";
  const ultima = p
    ? `<p>Última publicação: <b>${escapa(MOTIVOS[p.motivo] ?? p.motivo)}</b>, pedida ${q.includes("às") ? "em" : "às"} ${escapa(q)}.</p>`
    : `<p>Nada foi publicado pelo painel ainda. O site está como antes.</p>`;
  const noAr = e.musicasNoAr !== null ? `<p class="numero"><b>${e.musicasNoAr.toLocaleString("pt-BR")}</b> músicas no ar</p>` : "";
  el.innerHTML = cabecalho("Início", "Tudo o que você salva aqui vai pro site em uns 2 minutos.")
    + `<section class="folha resumo">${noAr}${ultima}`
    + `<div class="acoes"><a class="bt" href="/" target="_blank" rel="noopener">Ver o site</a>`
    + `<button class="bt claro" type="button" data-recarrega>Atualizar status</button></div></section>`
    + `<nav class="atalhos" aria-label="Atalhos">`
    + ATALHOS.map(([id, nome, desc]) => `<a href="#${id}"><b>${escapa(nome)}</b><span>${escapa(desc)}</span></a>`).join("")
    + `</nav>`;
  el.querySelector("[data-recarrega]")!.addEventListener("click", () => carrega());
}
