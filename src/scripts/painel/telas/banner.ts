import { LIMITES, validaBanner } from "../../../lib/painel/valida.ts";
import type { Banner } from "../../../lib/painel/tipos.ts";
import { api } from "../api.ts";
import { carrega, type Estado } from "../estado.ts";
import { enviaFoto } from "../foto.ts";
import { $, atualizaContadores, aviso, cabecalho, campo, comCarregando, escapa } from "../ui.ts";

/** Largura de verdade de cada prévia; o quadro é reduzido pra caber na coluna. */
const PREVIAS: [string, string, number][] = [["celular", "Prévia no celular", 375], ["computador", "Prévia no computador", 1280]];

const infoFoto = (recortada: boolean) => recortada
  ? "Foto com fundo transparente: aparece saindo do pôster, como a de hoje."
  : "Foto comum: preenche o pôster inteiro.";

export function montaBanner(el: HTMLElement, e: Estado) {
  const b = e.banner;
  let foto = { ...b.foto, src: `/api/admin/arquivos/${b.foto.chave}` };

  el.innerHTML = cabecalho("Banner", "A frase grande e a foto do topo do site.")
    + `<div class="banner-grade"><form class="folha" novalidate>`
    + `<h2>Frase grande</h2><p class="dica">Até ${LIMITES.linha} letras por linha. A última linha fica em itálico, com a última palavra em amarelo.</p>`
    + [0, 1, 2].map((i) => campo({ id: `linha${i + 1}`, rotulo: `Linha ${i + 1}`, valor: b.linhas[i], max: LIMITES.linha })).join("")
    + campo({ id: "frase", rotulo: "Frase de baixo", valor: b.frase, max: LIMITES.frase, dica: "Escreva *assim* pra deixar uma palavra em negrito." })
    + `<h2>Pôster</h2>`
    + campo({ id: "legenda1", rotulo: "Legenda grande", valor: b.legenda[0], max: LIMITES.legenda[0] })
    + campo({ id: "legenda2", rotulo: "Legenda em itálico", valor: b.legenda[1], max: LIMITES.legenda[1] })
    + `<div class="campo"><label for="foto">Trocar foto</label><p class="dica" id="dica-foto">JPG, PNG ou WebP. Com fundo transparente fica igual à de hoje.</p>`
    + `<div class="foto-atual"><img alt="Foto atual do banner" src="${escapa(foto.src)}" /><p class="foto-info" aria-live="polite">${infoFoto(foto.recortada)}</p></div>`
    + `<input type="file" id="foto" accept="image/*" aria-describedby="dica-foto" /></div>`
    + `<div class="acoes"><button class="bt" type="submit">Salvar banner</button></div></form>`
    + `<section class="previas" aria-label="Prévia"><p class="no-site-rot" aria-hidden="true"><span>Assim fica no site</span></p>`
    + PREVIAS.map(([id, titulo, w]) => `<figure class="previa-quadro" data-largura="${w}"><figcaption>${titulo.replace("Prévia no ", "")}</figcaption>`
      + `<div class="moldura"><iframe src="/admin/previa" title="${titulo}" id="previa-${id}" width="${w}" height="600" tabindex="-1" loading="eager"></iframe></div></figure>`).join("")
    + `</section></div>`;

  const form = $<HTMLFormElement>("form", el);
  const salvar = $<HTMLButtonElement>("button[type=submit]", form);
  const valor = (id: string) => $<HTMLInputElement>("#" + id, form).value;
  const dados = (): Banner => ({
    linhas: [valor("linha1"), valor("linha2"), valor("linha3")],
    frase: valor("frase"),
    legenda: [valor("legenda1"), valor("legenda2")],
    foto: { chave: foto.chave, recortada: foto.recortada },
  });

  /* prévia: manda os textos pros quadros a cada mudança */
  const quadros = [...el.querySelectorAll<HTMLIFrameElement>(".previa-quadro iframe")];
  const manda = (alvo?: Window | null) => {
    const d = dados();
    const msg = { tipo: "banner", dados: { linhas: d.linhas, frase: d.frase, legenda: d.legenda, foto: { src: foto.src, recortada: foto.recortada } } };
    for (const q of quadros) if (!alvo || q.contentWindow === alvo) q.contentWindow?.postMessage(msg, location.origin);
  };
  const ajusta = () => {
    for (const q of quadros) {
      const fig = q.closest<HTMLElement>(".previa-quadro")!;
      const escala = Math.min(1, fig.clientWidth / Number(fig.dataset.largura));
      q.style.transform = `scale(${escala})`;
      fig.querySelector<HTMLElement>(".moldura")!.style.height = Number(q.dataset.altura ?? 600) * escala + "px";
    }
  };
  const aoMensagem = (ev: MessageEvent) => {
    if (ev.origin !== location.origin) return;
    if (!el.isConnected) { removeEventListener("message", aoMensagem); return; }
    if (ev.data?.tipo === "previa-pronta") manda(ev.source as Window);
    if (ev.data?.tipo === "altura-previa") {
      const q = quadros.find((x) => x.contentWindow === ev.source);
      if (q) { q.dataset.altura = String(Math.ceil(ev.data.altura)); q.height = q.dataset.altura; ajusta(); }
    }
  };
  addEventListener("message", aoMensagem);
  const obs = new ResizeObserver(ajusta);
  obs.observe(el);

  const confere = () => { salvar.disabled = !atualizaContadores(form); };
  form.addEventListener("input", () => { confere(); manda(); });
  confere();

  /* foto: comprime, sobe e já mostra na prévia */
  const entrada = $<HTMLInputElement>("#foto", form);
  entrada.addEventListener("change", async () => {
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    const info = $(".foto-info", form);
    info.textContent = "Preparando a foto…";
    salvar.disabled = true;
    try {
      const nova = await enviaFoto(arquivo, (f) => api("POST", "/api/admin/arquivos", f));
      foto = nova;
      $<HTMLImageElement>(".foto-atual img", form).src = nova.src;
      info.textContent = infoFoto(nova.recortada);
      manda();
    } catch (erro) {
      info.textContent = (erro as Error).message;
      aviso((erro as Error).message, "erro");
    } finally {
      confere();
    }
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const r = validaBanner(dados());
    if (!r.ok) { aviso(r.erro, "erro"); return; }
    await comCarregando(salvar, async () => {
      await api("PUT", "/api/admin/banner", r.valor);
      aviso("Salvo. Publicando o site…");
      await carrega();
    });
  });
}
