import { formataZap, validaContato } from "../../../lib/painel/valida.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { $, aviso, cabecalho, campo, comCarregando, erroNoCampo, limpaErros } from "../ui.ts";

/** "Zap do KJ: Use um celular..." → campo zapKj, mensagem sem o prefixo. */
const PREFIXOS: [string, string][] = [["Zap de contato: ", "zapContato"], ["Zap do KJ: ", "zapKj"], ["Instagram: ", "instagram"], ["Facebook: ", "facebook"]];

export function montaContato(el: HTMLElement, e: Estado) {
  const c = e.contato;
  el.innerHTML = cabecalho("Contato", "Os números e redes que aparecem no site.")
    + `<form class="folha" novalidate>`
    + campo({ id: "zapContato", rotulo: "Zap de contato", valor: formataZap(c.zapContato), tipo: "tel", inputmode: "tel", autocomplete: "tel",
      dica: "Recebe quem quer alugar e quem pede música nova. Aparece no rodapé." })
    + campo({ id: "zapKj", rotulo: "Zap do KJ", valor: c.zapKj ? formataZap(c.zapKj) : "", tipo: "tel", inputmode: "tel",
      dica: "Recebe a comanda com as músicas. Deixe vazio pra usar o Zap de contato." })
    + campo({ id: "instagram", rotulo: "Instagram", valor: c.instagram, prefixo: "@" })
    + campo({ id: "facebook", rotulo: "Facebook", valor: c.facebook ?? "", prefixo: "facebook.com/", dica: "Opcional." })
    + `<div class="acoes"><button class="bt" type="submit">Salvar contato</button></div></form>`;

  const form = $<HTMLFormElement>("form", el);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    limpaErros(form);
    const dados = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const r = validaContato(dados);
    if (!r.ok) {
      const [prefixo, id] = PREFIXOS.find(([p]) => r.erro.startsWith(p)) ?? ["", "zapContato"];
      erroNoCampo(form, id, r.erro.slice(prefixo.length));
      $<HTMLInputElement>("#" + id, form).focus();
      return;
    }
    await comCarregando($<HTMLButtonElement>("button[type=submit]", form), async () => {
      await api("PUT", "/api/admin/contato", dados);
      aviso("Salvo. Publicando o site…");
      await carrega();
    });
  });
}
