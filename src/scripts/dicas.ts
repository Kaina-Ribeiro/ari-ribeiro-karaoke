/**
 * "Tenta aí" rotativo: a cada N segundos (do painel) troca as sugestões por outras sorteadas do catálogo.
 * Cada sugestão rola como placa de letreiro: a antiga sobe e some, a nova entra de baixo, uma depois da outra.
 * Para quando a pessoa está com o mouse/foco nelas, quando a faixa sai da tela ou a aba fica escondida.
 * Com "reduzir movimento" ligado, as sugestões ficam paradas.
 */
import type { Item } from "../lib/busca.ts";
import { sorteiaDicas, type Dica } from "../lib/dicas.ts";

const ESCALONA = 70; // ms entre uma sugestão e a próxima
const SAI = { duration: 200, easing: "cubic-bezier(.55,0,.8,.2)" };
const ENTRA = { duration: 420, easing: "cubic-bezier(.2,.9,.25,1.2)" };

export function iniciaDicas(itens: Item[], segundos: number) {
  const caixa = document.querySelector<HTMLElement>("#sugestoes");
  if (!caixa || !itens.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const faixa = caixa.closest<HTMLElement>(".dicas") ?? caixa;

  let atuais: Dica[] = [...caixa.querySelectorAll<HTMLButtonElement>("button")].map((b) => ({ tipo: b.dataset.tipo as Dica["tipo"], texto: b.dataset.q!, q: b.dataset.q! }));
  let visivel = true, emCima = false, trocando = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const parado = () => !visivel || emCima || document.hidden;

  const botao = (d: Dica) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="v"></span>`;
    preenche(b, d);
    return b;
  };
  const preenche = (b: HTMLButtonElement, d: Dica) => {
    b.dataset.q = d.q;
    b.dataset.tipo = d.tipo;
    b.setAttribute("aria-label", d.tipo === "nova" ? `Buscar ${d.texto} (novidade)` : `Buscar ${d.texto}`);
    b.querySelector(".v")!.textContent = d.texto;
  };

  async function troca() {
    if (parado()) return agenda();
    trocando = true;
    const novas = sorteiaDicas(itens, Math.random, atuais);
    const bts = [...caixa!.querySelectorAll<HTMLButtonElement>("button")];
    // a novidade pode não existir na primeira tela (o HTML do build só tem 3)
    while (bts.length < novas.length) {
      const b = botao(novas[bts.length]);
      b.style.width = "0px";
      b.querySelector<HTMLElement>(".v")!.style.opacity = "0";
      caixa!.append(b);
      bts.push(b);
    }
    await Promise.all(novas.map(async (d, i) => {
      const b = bts[i], v = b.querySelector<HTMLElement>(".v")!;
      const atraso = i * ESCALONA;
      await v.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-110%)", opacity: 0 }], { ...SAI, delay: atraso, fill: "forwards" }).finished;
      // a largura acompanha o texto novo, sem empurrar as vizinhas de uma vez
      const de = b.getBoundingClientRect().width;
      preenche(b, d);
      b.style.width = "";
      const para = b.getBoundingClientRect().width;
      b.animate([{ width: de + "px" }, { width: para + "px" }], { duration: 260, easing: "cubic-bezier(.3,.7,.3,1)" });
      v.style.opacity = "";
      v.getAnimations().forEach((a) => a.cancel());
      await v.animate([{ transform: "translateY(110%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], ENTRA).finished;
    }));
    atuais = novas;
    trocando = false;
    agenda();
  }
  function agenda() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!trocando) troca(); }, segundos * 1000);
  }

  faixa.addEventListener("pointerenter", () => (emCima = true));
  faixa.addEventListener("pointerleave", () => (emCima = false));
  faixa.addEventListener("focusin", () => (emCima = true));
  faixa.addEventListener("focusout", () => (emCima = false));
  new IntersectionObserver(([e]) => (visivel = e.isIntersecting)).observe(faixa);
  agenda();
}
