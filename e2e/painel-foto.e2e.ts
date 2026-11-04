import { expect, test } from "@playwright/test";

// Roda no iPhone (WebKit): o Safari não gera WebP no canvas, e no iPhone todo navegador é WebKit.
// Só escolhe a foto e confere a prévia; não salva nada (não mexe no banco dos outros testes).

test("foto comum num cartão funciona no iPhone", async ({ page }) => {
  await page.goto("/admin/#festa");
  await expect(page.locator("#status")).not.toHaveAttribute("data-tipo", "carregando");
  await page.getByRole("button", { name: "Novo cartão" }).click();
  await page.getByLabel("Foto (opcional)").setInputFiles("data/fixture/r2/fotos/telao.webp");
  await expect(page.locator(".editor .foto-info")).toHaveText("Foto nova, ainda não salva.");
});

test("foto com fundo transparente no banner funciona no iPhone", async ({ page }) => {
  await page.goto("/admin/#banner");
  await expect(page.locator("#status")).not.toHaveAttribute("data-tipo", "carregando");
  await page.getByLabel("Trocar foto").setInputFiles("public/img/ari-cantando.webp");
  await expect(page.locator(".foto-info")).toContainText("fundo transparente");
  await expect(page.frameLocator('iframe[title="Prévia no celular"]').locator(".poster img:not(.cheia)")).toHaveCount(1);
});

test.describe("navegador sem codificador WebP (Safari)", () => {
  // simula o WebKit sem WebP: pedir image/webp devolve PNG, como no Safari
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, tipo, q) {
        return original.call(this, cb, tipo === "image/webp" ? "image/png" : tipo, q);
      };
    });
  });

  test("foto comum vira JPG e entra no cartão", async ({ page }) => {
    await page.goto("/admin/#festa");
    await expect(page.locator("#status")).not.toHaveAttribute("data-tipo", "carregando");
    await page.getByRole("button", { name: "Novo cartão" }).click();
    const envio = page.waitForResponse((r) => r.url().endsWith("/api/admin/arquivos") && r.request().method() === "POST");
    await page.getByLabel("Foto (opcional)").setInputFiles("data/fixture/r2/fotos/telao.webp");
    expect((await (await envio).json()).chave).toMatch(/^fotos\/\w+\.jpg$/);
    await expect(page.locator(".editor .foto-info")).toHaveText("Foto nova, ainda não salva.");
  });

  test("foto com fundo transparente vira PNG e continua recortada", async ({ page }) => {
    await page.goto("/admin/#banner");
    await expect(page.locator("#status")).not.toHaveAttribute("data-tipo", "carregando");
    const envio = page.waitForResponse((r) => r.url().endsWith("/api/admin/arquivos") && r.request().method() === "POST");
    await page.getByLabel("Trocar foto").setInputFiles("public/img/ari-cantando.webp");
    expect((await (await envio).json()).chave).toMatch(/^fotos\/\w+\.png$/);
    await expect(page.locator(".foto-info")).toContainText("fundo transparente");
  });
});
