import { defineConfig, devices } from "@playwright/test";

// Os testes rodam no site gerado com data/fixture (pedaço real da planilha), não na planilha ao vivo:
// assim o resultado não muda quando o Ari mexe nas músicas.
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4322", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "pnpm build:offline && pnpm preview --port 4322",
    url: "http://localhost:4322",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
