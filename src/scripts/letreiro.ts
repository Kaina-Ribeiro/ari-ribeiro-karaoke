/* Bolinha de karaokê passando pelas palavras do letreiro, em loop. */
const h1 = document.querySelector<HTMLElement>("#letreiro");
const bola = document.querySelector<HTMLElement>("#bola");
if (h1 && bola) {
  const palavras = [...h1.querySelectorAll<HTMLElement>(".w")];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    palavras.forEach((w) => w.classList.add("cantada"));
  } else {
    let i = 0;
    let atual: HTMLElement | undefined; // palavra em que a bolinha está agora
    const poe = (w: HTMLElement) => {
      atual = w;
      const r = w.getBoundingClientRect(), base = h1.getBoundingClientRect();
      bola.style.left = r.left - base.left + r.width / 2 + "px";
      bola.style.top = r.top - base.top - bola.offsetHeight * 1.4 + "px";
    };
    // a fonte do letreiro chega depois e as palavras mudam de lugar (a Big Shoulders é mais estreita que a reserva):
    // a bolinha pula pra onde a palavra foi, sem atravessar a tela
    const reposiciona = () => {
      if (!atual) return;
      bola.style.transition = "none";
      poe(atual);
      void bola.offsetWidth;
      bola.style.transition = "";
    };
    document.fonts?.addEventListener("loadingdone", reposiciona);
    new ResizeObserver(reposiciona).observe(h1);

    const passo = () => {
      if (i >= palavras.length) {
        setTimeout(() => (bola.style.opacity = "0"), 400);
        setTimeout(() => {
          palavras.forEach((w) => w.classList.remove("cantada"));
          i = 0;
          bola.style.transition = "none";
          poe(palavras[0]);
          void bola.offsetWidth;
          bola.style.transition = "";
          bola.style.opacity = "1";
          setTimeout(passo, 500);
        }, 3200);
        return;
      }
      const w = palavras[i++];
      poe(w);
      setTimeout(() => w.classList.add("cantada"), 180);
      setTimeout(passo, 520);
    };
    // só começa com a fonte do letreiro na tela (no máximo 1,5 s de espera); até lá a bolinha fica escondida
    // (opacity 0 no CSS), em vez de parada no canto do título
    const comeca = () => {
      bola.style.transition = "none";
      poe(palavras[0]);
      void bola.offsetWidth;
      bola.style.transition = "";
      bola.style.opacity = "1";
      setTimeout(passo, 350);
    };
    let comecou = false;
    const umaVez = () => { if (!comecou) { comecou = true; comeca(); } };
    document.fonts?.ready.then(umaVez);
    setTimeout(umaVez, 1500);
  }
}
