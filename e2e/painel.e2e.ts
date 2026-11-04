import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Painel local (pnpm painel): login de teste em localhost, publicação simulada (sem GitHub).
test.describe.configure({ mode: "serial" });

const abre = async (page: Page, tela = "inicio") => {
  await page.goto("/admin/#" + tela);
  await expect(page.locator("#status")).not.toHaveAttribute("data-tipo", "carregando");
};
const semProblemaGrave = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => v.id)).toEqual([]);
};

test.describe("estrutura", () => {
  test("abre no Início com o status e todas as abas", async ({ page }) => {
    await abre(page);
    await expect(page.locator("h1")).toHaveText("Início");
    await expect(page.locator("nav.abas a")).toHaveText(["Início", "Catálogo", "Novidades", "Banner", "Festa", "Contato"]);
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
    await semProblemaGrave(page);
  });

  test("sem servidor, avisa em vez de quebrar", async ({ page }) => {
    await page.route("**/api/**", (r) => r.abort());
    await page.goto("/admin/#inicio");
    await expect(page.locator("#status")).toContainText("Sem conexão com o servidor");
  });
});

test.describe("contato", () => {
  test("salva o Zap e mostra formatado ao voltar", async ({ page }) => {
    await abre(page, "contato");
    await expect(page.locator("h1")).toHaveText("Contato");
    await page.getByLabel("Zap de contato").fill("(12) 98888-7777");
    await page.getByRole("button", { name: "Salvar contato" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await expect(page.locator("#status")).toContainText("No ar ✅");
    await page.reload();
    await expect(page.getByLabel("Zap de contato")).toHaveValue("(12) 98888-7777");
    // volta ao número de antes pros outros testes
    await page.getByLabel("Zap de contato").fill("12991167274");
    await page.getByRole("button", { name: "Salvar contato" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
  });

  test("Zap inválido mostra o erro no campo e não salva", async ({ page }) => {
    await abre(page, "contato");
    let salvou = false;
    page.on("request", (r) => { if (r.method() === "PUT") salvou = true; });
    await page.getByLabel("Zap do KJ").fill("1234");
    await page.getByRole("button", { name: "Salvar contato" }).click();
    await expect(page.locator("#erro-zapKj")).toHaveText("Use um celular com DDD: (12) 99999-9999");
    await expect(page.getByLabel("Zap do KJ")).toHaveAttribute("aria-invalid", "true");
    expect(salvou).toBe(false);
    await semProblemaGrave(page);
  });
});
