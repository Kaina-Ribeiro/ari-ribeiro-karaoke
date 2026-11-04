import { formataZap, normalizaUsuario, normalizaZap, validaContato } from "../../../lib/painel/valida.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { $, aviso, cabecalho, campo, comCarregando, erroNoCampo, escapa, limpaErros, noSite } from "../ui.ts";

/** "Zap do KJ: Use um celular..." → campo zapKj, mensagem sem o prefixo. */
const PREFIXOS: [string, string][] = [["Zap de contato: ", "zapContato"], ["Zap do KJ: ", "zapKj"], ["Instagram: ", "instagram"], ["Facebook: ", "facebook"]];

const hojeSP = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Rodapé do site (index.astro, footer#contato) com o que está nos campos agora. Campo ainda inválido: mostra como está escrito. */
function rodape(d: Record<string, string>): string {
  const zap = normalizaZap(d.zapContato ?? "");
  const insta = normalizaUsuario(d.instagram ?? "");
  const face = d.facebook?.trim() ? normalizaUsuario(d.facebook) : null;
  return `<div class="rodape-site"><p class="wordmark">Ari Ribeiro <em>karaokê</em></p><div class="contatos">`
    + `<div><small>WhatsApp</small><span class="num">${escapa(zap.ok ? formataZap(zap.valor) : d.zapContato || "—")}</span></div>`
    + `<div><small>Instagram e Facebook</small><span class="lk">@${escapa(insta.ok ? insta.valor : d.instagram ?? "")}</span>`
    + (face ? `<br /><span class="lk">Facebook</span>` : "") + `</div>`
    + `<div><small>Catálogo</small>Atualizado em ${hojeSP()}</div></div></div>`;
}

export function montaContato(el: HTMLElement, e: Estado) {
  const c = e.contato;
  el.innerHTML = cabecalho("Contato", "Os números e redes que aparecem no rodapé do site.")
    + `<div class="duas"><form class="folha" novalidate>`
    + campo({ id: "zapContato", rotulo: "Zap de contato", valor: formataZap(c.zapContato), tipo: "tel", inputmode: "tel", autocomplete: "tel",
      dica: "Recebe quem quer alugar e quem pede música nova. Aparece no rodapé." })
    + campo({ id: "zapKj", rotulo: "Zap do KJ", valor: c.zapKj ? formataZap(c.zapKj) : "", tipo: "tel", inputmode: "tel",
      dica: "Recebe a comanda com as músicas. Deixe vazio pra usar o Zap de contato." })
    + campo({ id: "instagram", rotulo: "Instagram", valor: c.instagram, prefixo: "@" })
    + campo({ id: "facebook", rotulo: "Facebook", valor: c.facebook ?? "", prefixo: "facebook.com/", dica: "Opcional." })
    + `<div class="acoes"><button class="bt" type="submit">Salvar contato</button></div></form>`
    + noSite(`<div id="previaRodape"></div><p class="no-site-nota">A prévia muda enquanto você digita. O Zap do KJ não aparece no site: ele só recebe a comanda.</p>`)
    + `</div>`;

  const form = $<HTMLFormElement>("form", el);
  const dados = () => Object.fromEntries(new FormData(form)) as Record<string, string>;
  const previa = $("#previaRodape", el);
  const desenha = () => { previa.innerHTML = rodape(dados()); };
  form.addEventListener("input", desenha);
  desenha();

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    limpaErros(form);
    const d = dados();
    const r = validaContato(d);
    if (!r.ok) {
      const [prefixo, id] = PREFIXOS.find(([p]) => r.erro.startsWith(p)) ?? ["", "zapContato"];
      erroNoCampo(form, id, r.erro.slice(prefixo.length));
      $<HTMLInputElement>("#" + id, form).focus();
      return;
    }
    await comCarregando($<HTMLButtonElement>("button[type=submit]", form), async () => {
      await api("PUT", "/api/admin/contato", d);
      aviso("Salvo. Publicando o site…");
      await carrega();
    }, "Salvo");
  });
}
