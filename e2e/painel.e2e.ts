import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import * as XLSX from "xlsx";
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

/* ---------- catálogo ---------- */
const tokenBuild = () => /^BUILD_TOKEN=(.+)$/m.exec(readFileSync(".dev.vars", "utf8"))![1].trim();
/** Simula a última publicação do build dizendo quantas músicas estão no ar (base da trava de 50%). */
const defineNoAr = (page: Page, musicas: number) =>
  page.request.post("/api/build/status", { headers: { Authorization: `Bearer ${tokenBuild()}` }, data: { status: "ok", musicas } });

test.describe("catálogo", () => {
  test("enviar .xlsx mostra a prévia e publica", async ({ page }) => {
    await defineNoAr(page, 95);
    await abre(page, "catalogo");
    await expect(page.locator("h1")).toHaveText("Catálogo");
    await page.getByLabel("Arquivo .xlsx").check();
    await page.getByLabel("Escolha o arquivo").setInputFiles("data/fixture/musicas.xlsx");
    await expect(page.locator(".previa")).toContainText("95 músicas");
    await page.getByRole("button", { name: "Confirmar e publicar" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await expect(page.locator("#status")).toContainText("No ar ✅");
    const e = await (await page.request.get("/api/admin/estado")).json();
    expect(e.catalogo.fonte).toBe("arquivo");
    expect(e.catalogo.arquivo).toMatchObject({ nome: "musicas.xlsx", musicas: 95 });
  });

  test(".xlsx sem a aba Músicas: erro e Confirmar travado", async ({ page }, info) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["codigo", "titulo"]]), "Planilha1");
    const arq = info.outputPath("sem-aba.xlsx");
    mkdirSync(dirname(arq), { recursive: true });
    writeFileSync(arq, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    await abre(page, "catalogo");
    await page.getByLabel("Arquivo .xlsx").check();
    await page.getByLabel("Escolha o arquivo").setInputFiles(arq);
    await expect(page.locator(".previa")).toContainText('O arquivo não tem a aba "Músicas".');
    await expect(page.getByRole("button", { name: "Confirmar e publicar" })).toBeDisabled();
  });

  test("arquivo com menos da metade das músicas no ar pede confirmação extra", async ({ page }) => {
    await defineNoAr(page, 100000);
    await abre(page, "catalogo");
    await page.getByLabel("Arquivo .xlsx").check();
    await page.getByLabel("Escolha o arquivo").setInputFiles("data/fixture/musicas.xlsx");
    const confirmar = page.getByRole("button", { name: "Confirmar e publicar" });
    await expect(page.locator(".previa")).toContainText("menos da metade");
    await expect(confirmar).toBeDisabled();
    await page.getByLabel("Sim, o catálogo novo tem menos músicas mesmo").check();
    await expect(confirmar).toBeEnabled();
    await defineNoAr(page, 95);
  });

  test("link: Salvar só depois de testar esse mesmo link", async ({ page }) => {
    await page.route("**/api/admin/link/teste?*", (r) => r.fulfill({ json: { ok: true, id: "1abcdefghijklmnop_XYZ" } }));
    await abre(page, "catalogo");
    await page.getByLabel("Link do Google").check();
    const campoLink = page.getByLabel("Link da planilha");
    const salvar = page.getByRole("button", { name: "Salvar link" });
    await campoLink.fill("https://docs.google.com/spreadsheets/d/1abcdefghijklmnop_XYZ/edit");
    await expect(salvar).toBeDisabled();
    await page.getByRole("button", { name: "Testar" }).click();
    await expect(page.locator(".teste-link")).toContainText("Planilha pública");
    await expect(salvar).toBeEnabled();
    await campoLink.fill("https://docs.google.com/spreadsheets/d/outra_planilha_123/edit");
    await expect(salvar).toBeDisabled();
    // volta pra planilha do Ari (só leitura) pros outros testes
    await campoLink.fill("https://docs.google.com/spreadsheets/d/1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx");
    await page.getByRole("button", { name: "Testar" }).click();
    await salvar.click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await expect(page.getByRole("button", { name: "Atualizar catálogo" })).toBeVisible();
    await semProblemaGrave(page);
  });
});

/* ---------- novidades ---------- */
test.describe("novidades", () => {
  const linha = (page: Page, nome: string) => page.locator(".pacote").filter({ has: page.getByText(nome, { exact: true }) });

  test("trocar a classificação de um pacote vale depois de recarregar", async ({ page }) => {
    await abre(page, "novidades");
    await expect(page.locator("h1")).toHaveText("Novidades");
    await expect(linha(page, "13K").locator(".tag")).toHaveText("nova");
    await page.getByLabel("Classificação de 13K").selectOption("exc");
    await expect(linha(page, "13K").locator(".tag")).toHaveText("só no Ari");
    await page.reload();
    await expect(page.getByLabel("Classificação de 13K")).toHaveValue("exc");
    await page.getByLabel("Classificação de 13K").selectOption("auto");
    await expect(linha(page, "13K").locator(".tag")).toHaveText("nova");
  });

  test("busca por nome e filtro de novidades", async ({ page }) => {
    await abre(page, "novidades");
    await page.getByLabel("Buscar pacote").fill("excl");
    await expect(page.locator(".pacote:visible")).toHaveCount(1);
    await expect(page.locator(".pacote:visible .nome")).toHaveText("ARI EXCLUSIVO");
    await page.getByLabel("Buscar pacote").fill("");
    await page.getByLabel("Só os que estão como Novidade").check();
    await expect(page.locator(".pacote:visible").first()).toBeVisible();
    expect(new Set(await page.locator(".pacote:visible .tag").allTextContents())).toEqual(new Set(["nova"]));
  });

  test("prazo do automático", async ({ page }) => {
    await abre(page, "novidades");
    const prazo = page.getByLabel("Dias como novidade");
    await prazo.fill("0");
    await page.getByRole("button", { name: "Salvar prazo" }).click();
    await expect(page.locator("#erro-prazo")).toHaveText("O prazo precisa ser de 1 a 365 dias");
    await prazo.fill("30");
    await page.getByRole("button", { name: "Salvar prazo" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await prazo.fill("60");
    await page.getByRole("button", { name: "Salvar prazo" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await semProblemaGrave(page);
  });
});

/* ---------- banner ---------- */
test.describe("banner", () => {
  const previaCelular = (page: Page) => page.frameLocator('iframe[title="Prévia no celular"]');

  test("a prévia acompanha a digitação e o limite trava o Salvar", async ({ page }) => {
    await abre(page, "banner");
    await expect(page.locator("h1")).toHaveText("Banner");
    await expect(previaCelular(page).locator("#letreiro")).toContainText("Solta");
    await page.getByLabel("Linha 1").fill("Canta");
    await expect(previaCelular(page).locator("#letreiro")).toContainText("Canta");
    await expect(page.frameLocator('iframe[title="Prévia no computador"]').locator("#letreiro")).toContainText("Canta");
    await page.getByLabel("Linha 1").fill("Quinze letras!!");
    await expect(page.locator(".entrada.passou")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Salvar banner" })).toBeDisabled();
    await page.getByLabel("Linha 1").fill("Solta");
    await expect(page.getByRole("button", { name: "Salvar banner" })).toBeEnabled();
  });

  test("foto comum preenche o pôster; salvar publica", async ({ page }) => {
    await abre(page, "banner");
    await page.getByLabel("Trocar foto").setInputFiles("data/fixture/r2/fotos/telao.webp");
    await expect(page.locator(".foto-info")).toContainText("preenche o pôster");
    await expect(previaCelular(page).locator(".poster img.cheia")).toHaveCount(1);
    await page.getByRole("button", { name: "Salvar banner" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await expect(page.locator("#status")).toContainText("No ar ✅");
    // volta a foto do Ari (recortada) pros outros testes
    const e = await (await page.request.get("/api/admin/estado")).json();
    expect(e.banner.foto.recortada).toBe(false);
    await page.request.put("/api/admin/banner", {
      headers: { Origin: "http://localhost:8788" },
      data: { ...e.banner, foto: { chave: "fotos/ari-cantando.webp", recortada: true } },
    });
    await semProblemaGrave(page);
  });
});
