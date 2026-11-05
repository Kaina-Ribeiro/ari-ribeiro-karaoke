/**
 * Reproduz a bolinha do letreiro: N recargas em Chromium e WebKit no desktop.
 * Em cada recarga, amostra a bolinha a cada 100 ms por ~4,5 s (um ciclo passa pelas 5 palavras)
 * e anota se ela estava visível (display, opacidade, dentro do cartaz e da tela) e em cima de qual palavra.
 * Também confere se o alvo da bolinha é o meio de uma palavra (fonte que chega tarde mudava as palavras de lugar).
 * Uso (com o `pnpm painel` no ar): pnpm bola [recargas]  ·  ATRASO_FONTE=2500 pnpm bola  (fonte do Google chegando 2,5 s depois)
 */
import { chromium, webkit } from "@playwright/test";

const LOCAL = process.env.LOCAL ?? `http://localhost:${process.env.PAINEL_PORTA ?? "8788"}`;
const N = Number(process.argv[2] ?? 20);
const LARG = Number(process.env.LARG ?? 1440);
const ATRASO_FONTE = Number(process.env.ATRASO_FONTE ?? 0); // ms: simula a fonte do Google chegando tarde
const DURA = Number(process.env.DURA ?? 4500);
let falhas = 0;

for (const [nome, tipo] of [["chromium", chromium], ["webkit", webkit]] as const) {
  const nav = await tipo.launch();
  for (let k = 0; k < N; k++) {
    const ctx = await nav.newContext({ viewport: { width: LARG, height: 900 } });
    const p = await ctx.newPage();
    if (ATRASO_FONTE) await p.route(/fonts\.gstatic\.com/, async (r) => { await new Promise((ok) => setTimeout(ok, ATRASO_FONTE)); await r.continue(); });
    await p.goto(LOCAL + "/?r=" + k, { waitUntil: "commit" });
    await p.waitForSelector("#bola", { state: "attached" });
    const amostras = await p.evaluate(async (DURA) => {
      const bola = document.querySelector<HTMLElement>("#bola")!;
      
      const ws = [...document.querySelectorAll<HTMLElement>("#letreiro .w")];
      const out: { t: number; vis: boolean; motivo: string; perto: number; fontes: string }[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < DURA) {
        const cs = getComputedStyle(bola), r = bola.getBoundingClientRect(), cartaz = document.querySelector<HTMLElement>(".cartaz")!.getBoundingClientRect();
        let motivo = "";
        if (cs.display === "none") motivo = "display:none";
        else if (+cs.opacity < 0.5) motivo = "opacidade " + cs.opacity;
        else if (r.width < 2) motivo = "sem tamanho";
        else if (r.bottom < cartaz.top || r.top > cartaz.bottom || r.right < cartaz.left || r.left > cartaz.right) motivo = `fora do cartaz (${r.left|0},${r.top|0})`;
        else if (r.bottom < 0 || r.top > innerHeight) motivo = "fora da tela";
        else if (bola.style.left) {
          // o alvo da bolinha tem que ser o meio de alguma palavra, na posição de agora
          const base = document.querySelector<HTMLElement>("#letreiro")!.getBoundingClientRect(), alvo = parseFloat(bola.style.left);
          const dx = Math.min(...ws.map((w) => { const b = w.getBoundingClientRect(); return Math.abs(b.left - base.left + b.width / 2 - alvo); }));
          if (dx > 6) motivo = `fora da palavra ${Math.round(dx)}px`;
        }
        // palavra com centro mais perto do centro da bolinha (na horizontal)
        const cx = r.left + r.width / 2;
        let perto = -1, d = 1e9;
        ws.forEach((w, i) => { const b = w.getBoundingClientRect(); const dd = Math.abs(b.left + b.width / 2 - cx) + Math.abs(b.top - r.bottom); if (dd < d) { d = dd; perto = i; } });
        out.push({ t: Math.round(performance.now() - t0), vis: !motivo, motivo, perto, fontes: document.fonts.status });
        await new Promise((ok) => setTimeout(ok, 100));
      }
      return out;
    }, DURA);
    const visiveis = amostras.filter((a) => a.vis);
    const motivos = [...new Set(amostras.filter((a) => !a.vis).map((a) => a.motivo))];
    // depois do 1º passo (350 ms) a bolinha tem que aparecer
    const sumiu = amostras.filter((a) => (a.t > 1900 && a.t < 3000 && !a.vis) || a.motivo.startsWith("fora"));
    const ok = sumiu.length === 0 && visiveis.length > 0;
    if (!ok) falhas++;
    const fontesOk = amostras.find((a) => a.fontes === "loaded")?.t ?? -1;
    const linha = amostras.map((a) => (a.vis ? String(a.perto) : a.motivo.startsWith("opac") ? "·" : a.motivo.startsWith("fora") ? "F" : a.motivo.startsWith("opac") ? "·" : "x")).join("");
    console.log(`${nome} #${String(k + 1).padStart(2)} ${ok ? "✅" : "❌"} ${linha} fontes ok em ${fontesOk}ms ${motivos.filter((m) => !m.startsWith("opac")).join(" | ")}`);
    await ctx.close();
  }
  await nav.close();
}
console.log(falhas ? `❌ ${falhas} recargas com a bolinha sumida` : `✅ bolinha visível em todas as ${N * 2} recargas`);
process.exit(falhas ? 1 : 0);
