/* Bolinha de karaokê passando pelas palavras do letreiro, em loop. */
const h1 = document.querySelector<HTMLElement>("#letreiro");
const bola = document.querySelector<HTMLElement>("#bola");
if (h1 && bola) {
  const palavras = [...h1.querySelectorAll<HTMLElement>(".w")];
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    palavras.forEach((w) => w.classList.add("cantada"));
  } else {
    let i = 0;
    const poe = (w: HTMLElement) => {
      const r = w.getBoundingClientRect(), base = h1.getBoundingClientRect();
      bola.style.left = r.left - base.left + r.width / 2 + "px";
      bola.style.top = r.top - base.top - bola.offsetHeight * 1.4 + "px";
    };
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
    setTimeout(passo, 350);
  }
}
