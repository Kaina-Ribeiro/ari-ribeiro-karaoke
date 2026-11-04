/**
 * `pnpm prints` (com o `pnpm painel` no ar): fotos do site e de cada tela do painel em 375/768/1024/1440 px,
 * e antes/depois do cartaz e dos cartões de festa (antes = site no ar, só leitura; depois = local).
 * Salva em prints/ e avisa se alguma página passa da largura da tela.
 */
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";

const LOCAL = process.env.LOCAL ?? `http://localhost:${process.env.PAINEL_PORTA ?? "8788"}`;
const NO_AR = process.env.NO_AR ?? "https://ari-ribeiro-karaoke.pages.dev";
const LARGURAS = [375, 768, 1024, 1440];
const TELAS = ["inicio", "catalogo", "novidades", "banner", "festa", "contato"];
const PASTA = new URL("../prints/", import.meta.url);
const arquivo = (nome: string) => new URL(nome + ".png", PASTA).pathname.replace(/^\/([A-Z]:)/, "$1");

const transborda = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const problemas: string[] = [];

await mkdir(PASTA, { recursive: true });
const navegador = await chromium.launch();
for (const w of LARGURAS) {
  const p = await navegador.newPage({ viewport: { width: w, height: w < 800 ? 812 : 900 }, reducedMotion: "reduce" });
  await p.goto(LOCAL + "/", { waitUntil: "networkidle" });
  if (await transborda(p)) problemas.push(`site ${w}px`);
  await p.screenshot({ path: arquivo(`site-${w}`), fullPage: true });
  for (const t of TELAS) {
    await p.goto(`${LOCAL}/admin/#${t}`);
    await p.waitForSelector("#status:not([data-tipo=carregando])");
    await p.waitForTimeout(400);
    if (await transborda(p)) problemas.push(`painel ${t} ${w}px`);
    await p.screenshot({ path: arquivo(`painel-${t}-${w}`), fullPage: true });
  }
  await p.close();
}
for (const [nome, base] of [["antes", NO_AR], ["depois", LOCAL]]) {
  for (const w of [375, 1440]) {
    const p = await navegador.newPage({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
    await p.goto(base + "/", { waitUntil: "networkidle" });
    await p.locator(".cartaz").screenshot({ path: arquivo(`${nome}-cartaz-${w}`) });
    await p.locator("#festa").scrollIntoViewIfNeeded();
    await p.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".cz img")].every((i) => i.complete));
    await p.locator("#festa").screenshot({ path: arquivo(`${nome}-festa-${w}`) });
    await p.close();
  }
}
await navegador.close();
console.log(problemas.length ? `❌ Passa da largura: ${problemas.join(", ")}` : `✅ ${LARGURAS.length * (TELAS.length + 1)} prints sem transbordo, mais antes/depois. Em prints/.`);
if (problemas.length) process.exit(1);
