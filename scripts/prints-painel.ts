/**
 * `pnpm prints:painel [pasta]` (com o `pnpm painel` no ar): telas do painel em 375/768/1024/1440 px,
 * página inteira e só a primeira tela (o que cabe no monitor), mais os estados de hover, toque e foco.
 * Salva em prints/painel/<pasta>/ (padrão "atual"), pra comparar antes e depois lado a lado.
 */
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";

const LOCAL = process.env.LOCAL ?? `http://localhost:${process.env.PAINEL_PORTA ?? "8788"}`;
const LARGURAS = [375, 768, 1024, 1440];
const TELAS = (process.env.TELAS ?? "inicio,catalogo,festa,contato").split(",");
const PASTA = new URL(`../prints/painel/${process.argv[2] ?? "atual"}/`, import.meta.url);
const arquivo = (nome: string) => new URL(nome + ".png", PASTA).pathname.replace(/^\/([A-Z]:)/, "$1");

const transborda = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const problemas: string[] = [];

async function abre(p: Page, tela: string) {
  await p.goto(`${LOCAL}/admin/#${tela}`);
  await p.waitForSelector("#status:not([data-tipo=carregando])");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
}

await mkdir(PASTA, { recursive: true });
const navegador = await chromium.launch();
for (const w of LARGURAS) {
  const p = await navegador.newPage({ viewport: { width: w, height: w < 800 ? 812 : 900 }, reducedMotion: "reduce" });
  for (const t of TELAS) {
    await abre(p, t);
    if (await transborda(p)) problemas.push(`${t} ${w}px`);
    await p.screenshot({ path: arquivo(`${t}-${w}`), fullPage: true });
    await p.screenshot({ path: arquivo(`${t}-${w}-tela`) });
  }
  await p.close();
}

/* estados: hover numa aba e num botão, foco de teclado, toque (mouse apertado) */
for (const w of [375, 1440]) {
  const p = await navegador.newPage({ viewport: { width: w, height: w < 800 ? 812 : 900 } });
  await abre(p, "inicio");
  await p.locator("nav.abas a").nth(1).hover();
  await p.waitForTimeout(300);
  await p.screenshot({ path: arquivo(`estado-hover-aba-${w}`) });
  await p.locator(".atalhos a").first().hover();
  await p.waitForTimeout(300);
  await p.screenshot({ path: arquivo(`estado-hover-atalho-${w}`) });
  await p.mouse.move(0, 0);
  await p.locator("nav.abas a").nth(2).focus();
  await p.keyboard.press("Shift+Tab");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(300);
  await p.screenshot({ path: arquivo(`estado-foco-aba-${w}`) });
  await abre(p, "contato");
  const bt = p.locator("button.bt[type=submit]").first();
  await bt.scrollIntoViewIfNeeded();
  await bt.hover();
  await p.waitForTimeout(300);
  await p.screenshot({ path: arquivo(`estado-hover-salvar-${w}`) });
  await p.mouse.down();
  await p.waitForTimeout(150);
  await p.screenshot({ path: arquivo(`estado-toque-salvar-${w}`) });
  // solta fora do botão: não salva nada
  await p.mouse.move(1, 1);
  await p.mouse.up();
  await bt.focus();
  await p.keyboard.press("Shift+Tab");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(300);
  await p.screenshot({ path: arquivo(`estado-foco-salvar-${w}`) });
  // botão de foto em pt-BR
  await abre(p, "banner");
  await p.locator(".arquivo").scrollIntoViewIfNeeded();
  await p.locator(".arquivo").screenshot({ path: arquivo(`estado-arquivo-${w}`) });
  await p.close();
}

/* barra lateral numa página comprida, rolada até o fim: tem que continuar presa no topo da tela */
{
  const p = await navegador.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await abre(p, "contato");
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(300);
  const topo = await p.evaluate(() => [scrollY, document.querySelector(".lado")!.getBoundingClientRect().top]);
  if (topo[0] < 100 || Math.abs(topo[1]) >= 1) problemas.push(`barra lateral fora do topo (rolagem ${topo[0]}, topo ${topo[1]})`);
  await p.screenshot({ path: arquivo("estado-rolado-fim-1440") });
  await p.close();
}
await navegador.close();
console.log(problemas.length ? `❌ Passa da largura: ${problemas.join(", ")}` : `✅ Prints sem transbordo em ${PASTA.pathname}`);
if (problemas.length) process.exit(1);
