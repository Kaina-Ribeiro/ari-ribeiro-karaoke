import { defineConfig, devices } from "@playwright/test";

// Os testes rodam no `pnpm painel`: site gerado com data/fixture (pedaço real da planilha) + API e painel
// no wrangler pages dev, com D1/R2 locais zerados a cada subida. O resultado não muda quando o Ari mexe nas músicas.
const SITE = /catalogo\.e2e\.ts/;
// PAINEL_PORTA=8790 pnpm e2e: roda numa porta própria (outra worktree pode estar na 8788)
const LOCAL = `http://localhost:${process.env.PAINEL_PORTA ?? "8788"}`;
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: LOCAL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "desktop", testMatch: SITE, use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
    { name: "celular", testMatch: SITE, use: { ...devices["Pixel 7"] } },
    { name: "iphone", testMatch: SITE, use: { ...devices["iPhone 13"] } },
    // o painel grava no banco: um projeto só e em série, pra um teste não mexer no dado do outro
    { name: "painel", testMatch: /painel\.e2e\.ts/, fullyParallel: false, use: { ...devices["Pixel 7"] } },
    // fotos no iPhone (WebKit, onde o canvas não gera WebP): só prévia, não grava no banco
    { name: "painel-iphone", testMatch: /painel-foto\.e2e\.ts/, use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "pnpm painel",
    url: LOCAL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
