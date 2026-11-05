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
  expect(r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => v.id + " " + v.nodes.map((n) => n.target + " " + n.failureSummary).join(" / "))).toEqual([]);
};

test.describe("estrutura", () => {
  test("abre no Início com o status e todas as abas", async ({ page }) => {
    await abre(page);
    await expect(page.locator("h1")).toHaveText(/O site está no ar|Publicando o site/);
    await expect(page.locator("nav.abas a")).toHaveText(["Início", "Catálogo", "Novidades", "Banner", "Festa", "Contato"]);
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Atalhos" }).getByRole("link")).toHaveCount(5);
    await semProblemaGrave(page);
  });

  test("mostra quem entrou e o Sair leva pro logout do Access", async ({ page }) => {
    await abre(page);
    // login de teste do .dev.vars (DEV_ADMIN_EMAIL)
    const email = /^DEV_ADMIN_EMAIL=(.+)$/m.exec(readFileSync(".dev.vars", "utf8"))![1].trim().toLowerCase();
    await expect(page.locator("#email")).toHaveText(email);
    const sair = page.getByRole("link", { name: "Sair" });
    await expect(sair).toBeVisible();
    await expect(sair).toHaveAttribute("href", "/cdn-cgi/access/logout");
    // no celular o Sair fica na barra de cima, à vista sem rolar
    const caixa = (await sair.boundingBox())!;
    expect(caixa.y).toBeLessThan(80);
    await abre(page, "contato");
    await expect(sair).toBeVisible();
  });

  test("sem servidor, avisa em vez de quebrar", async ({ page }) => {
    await page.route("**/api/**", (r) => r.abort());
    await page.goto("/admin/#inicio");
    await expect(page.locator("#status")).toContainText("Sem conexão com o servidor");
  });
});

test.describe("contato", () => {
  // banco local: importado da fixture (Contato para locação = 12991167274, o do Ari)
  const zaps = (page: Page) => page.locator(".zap-item");
  const salva = async (page: Page) => {
    await page.getByRole("button", { name: "Salvar contato" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
  };

  test("o contato importado vira o WhatsApp geral, com o Instagram", async ({ page }) => {
    await abre(page, "contato");
    await expect(page.locator("h1")).toHaveText("Contato");
    await expect(zaps(page)).toHaveCount(1);
    await expect(zaps(page).first().getByLabel("Nome no rodapé")).toHaveValue("WhatsApp - Ari");
    await expect(zaps(page).first().getByLabel("Número")).toHaveValue("(12) 99116-7274");
    await expect(zaps(page).first().getByRole("radio", { name: "É o geral" })).toBeChecked();
    await expect(zaps(page).first().getByRole("button", { name: /^Remover/ })).toBeDisabled();
    await expect(page.getByLabel("Usuário do Instagram")).toHaveValue("ariribeirokaraoke");
    await expect(page.locator("#previaRodape small")).toHaveText(["WhatsApp - Ari", "Instagram", "Catálogo"]);
    await semProblemaGrave(page);
  });

  test("telefone formata enquanto digita e apagar não trava", async ({ page }) => {
    await abre(page, "contato");
    await page.getByRole("button", { name: "Adicionar WhatsApp" }).click();
    const num = zaps(page).last().getByLabel("Número");
    await num.pressSequentially("12988887777");
    await expect(num).toHaveValue("(12) 98888-7777");
    await num.press("Backspace");
    await num.press("Backspace");
    await num.press("Backspace");
    await num.press("Backspace");
    await expect(num).toHaveValue("(12) 98888");
    // Backspace logo depois do ") " apaga o dígito antes dele
    await num.fill("");
    await num.pressSequentially("12988887777");
    await num.evaluate((i: HTMLInputElement) => i.setSelectionRange(5, 5));
    await num.press("Backspace");
    await expect(num).toHaveValue("(19) 88887-777");
    // colar com +55 também formata
    await num.fill("+55 12 99119-6050");
    await expect(num).toHaveValue("(12) 99119-6050");
  });

  test("vários WhatsApp, quem recebe o quê e redes: salva, aparece na prévia e volta igual", async ({ page }) => {
    await abre(page, "contato");
    await page.getByRole("button", { name: "Adicionar WhatsApp" }).click();
    const novo = zaps(page).last();
    await expect(novo.getByLabel("Nome no rodapé")).toBeFocused();
    await novo.getByLabel("Nome no rodapé").fill("WhatsApp - Ana Paula");
    await novo.getByLabel("Número").pressSequentially("12991196050");
    await page.getByLabel("Zap do “Pedir música nova”").selectOption({ label: "WhatsApp - Ana Paula" });
    await page.getByRole("button", { name: "Adicionar YouTube" }).click();
    await page.getByLabel("Usuário do YouTube").fill("https://www.youtube.com/@AriRibeiro");
    await page.getByRole("button", { name: "Adicionar TikTok" }).click();
    await page.getByLabel("Usuário do TikTok").fill("ariribeirokaraoke");
    await page.locator(".perfil", { has: page.getByLabel("Usuário do TikTok") }).getByRole("checkbox", { name: "Mostrar no rodapé" }).uncheck();
    // a prévia acompanha: a Ana Paula, o YouTube; o TikTok desligado não
    await expect(page.locator("#previaRodape small")).toHaveText(["WhatsApp - Ari", "WhatsApp - Ana Paula", "Instagram", "YouTube", "Catálogo"]);
    await expect(page.locator("#previaRodape")).toContainText("(12) 99119-6050");
    await expect(page.locator("#previaRodape")).toContainText("@AriRibeiro");
    // Ana Paula sobe pro primeiro lugar
    await novo.getByRole("button", { name: "Subir WhatsApp - Ana Paula" }).click();
    await expect(zaps(page).first().getByLabel("Nome no rodapé")).toHaveValue("WhatsApp - Ana Paula");
    await salva(page);
    await expect(page.locator("#status")).toContainText("No ar ✅");

    await page.reload();
    await expect(zaps(page)).toHaveCount(2);
    await expect(zaps(page).first().getByLabel("Número")).toHaveValue("(12) 99119-6050");
    await expect(page.getByLabel("Zap do “Pedir música nova”")).toHaveValue(/.+/);
    await expect(page.getByLabel("Zap do “Pedir música nova”").locator("option:checked")).toHaveText("WhatsApp - Ana Paula");
    await expect(page.getByLabel("Usuário do YouTube")).toHaveValue("AriRibeiro");
    await expect(page.locator(".perfil", { has: page.getByLabel("Usuário do TikTok") }).getByRole("checkbox")).not.toBeChecked();
    await semProblemaGrave(page);

    // volta ao contato de antes pros outros testes
    await zaps(page).first().getByRole("button", { name: "Remover WhatsApp - Ana Paula" }).click();
    await page.getByRole("button", { name: "Remover YouTube" }).click();
    await page.getByRole("button", { name: "Remover TikTok" }).click();
    await expect(page.getByLabel("Zap do “Pedir música nova”")).toHaveValue("");
    await salva(page);
  });

  test("Zap inválido mostra o erro no campo e não salva", async ({ page }) => {
    await abre(page, "contato");
    let salvou = false;
    page.on("request", (r) => { if (r.method() === "PUT") salvou = true; });
    await page.getByRole("button", { name: "Adicionar WhatsApp" }).click();
    const novo = zaps(page).last();
    await novo.getByLabel("Nome no rodapé").fill("WhatsApp do KJ");
    await novo.getByLabel("Número").fill("1234");
    await page.getByRole("button", { name: "Salvar contato" }).click();
    await expect(novo.locator(".campo").nth(1).locator(".erro")).toHaveText("Use um celular com DDD: (12) 99999-9999");
    await expect(novo.getByLabel("Número")).toHaveAttribute("aria-invalid", "true");
    await expect(novo.getByLabel("Número")).toBeFocused();
    // sem nome também avisa no campo
    await novo.getByLabel("Número").fill("12981234567");
    await novo.getByLabel("Nome no rodapé").fill("");
    await page.getByRole("button", { name: "Salvar contato" }).click();
    await expect(novo.getByLabel("Nome no rodapé")).toHaveAttribute("aria-invalid", "true");
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
    await expect(page.locator(".previa li").first()).toHaveText(/Músicas\s*95/);
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

test.describe("Tenta aí", () => {
  test("tempo da troca: aceita vírgula, recusa fora de 2 a 15 e volta igual depois de recarregar", async ({ page }) => {
    await abre(page, "catalogo");
    const tempo = page.getByLabel("Trocar a cada (segundos)");
    const salvar = page.getByRole("button", { name: "Salvar tempo" });
    await expect(tempo).toHaveValue("4");
    await tempo.fill("1");
    await salvar.click();
    await expect(page.locator("#erro-segundos")).toHaveText("O tempo precisa ser de 2 a 15 segundos");
    await tempo.fill("6,5");
    await salvar.click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await page.reload();
    await expect(page.getByLabel("Trocar a cada (segundos)")).toHaveValue("6,5");
    // volta pro padrão pros outros testes
    await page.getByLabel("Trocar a cada (segundos)").fill("4");
    await page.getByRole("button", { name: "Salvar tempo" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    // o axe mede a cor no meio da transição do "✓ Salvo": espera ela terminar
    await expect(page.locator("#formDicas .bt.salvo")).toHaveCSS("color", "rgb(255, 255, 255)");
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
      headers: { Origin: new URL(page.url()).origin },
      data: { ...e.banner, foto: { chave: "fotos/ari-cantando.webp", recortada: true } },
    });
    await semProblemaGrave(page);
  });
});

/* ---------- pra sua festa ---------- */
test.describe("pra sua festa", () => {
  test("criar, subir, desligar e apagar um cartão", async ({ page }) => {
    const titulo = `Cartão e2e ${Date.now() % 100000}`;
    await abre(page, "festa");
    await expect(page.locator("h1")).toHaveText("Pra sua festa");
    const cartoes = page.locator(".cartao-item");
    const antes = await cartoes.count();

    await page.getByRole("button", { name: "Novo cartão" }).click();
    await page.getByLabel("Título").fill(titulo);
    await page.getByLabel("Destaque").fill("Teste");
    await page.getByLabel("Descrição").fill("Cartão criado pelo teste automático.");
    await page.getByRole("button", { name: "Salvar cartão" }).click();
    await expect(page.locator("#aviso")).toContainText("Salvo");
    await expect(cartoes).toHaveCount(antes + 1);
    await expect(cartoes.last().locator("b")).toHaveText(titulo);

    await page.getByRole("button", { name: `Subir ${titulo}` }).click();
    await expect(cartoes.nth(antes - 1).locator("b")).toHaveText(titulo);
    await page.reload();
    await expect(cartoes.nth(antes - 1).locator("b")).toHaveText(titulo);

    await page.getByRole("button", { name: `Desligar ${titulo}` }).click();
    await expect(cartoes.nth(antes - 1).locator(".desligado")).toHaveText("Desligado");

    await page.getByRole("button", { name: `Apagar ${titulo}` }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toContainText(`Apagar o cartão ${titulo}? Não dá para desfazer.`);
    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    await expect(cartoes).toHaveCount(antes + 1);
    await page.getByRole("button", { name: `Apagar ${titulo}` }).click();
    await dialogo.getByRole("button", { name: "Apagar" }).click();
    await expect(cartoes).toHaveCount(antes);
    await semProblemaGrave(page);
  });

  test("cartão escolhe o seu WhatsApp e ganha preço, com prévia ao vivo", async ({ page }) => {
    await abre(page, "festa");
    const origem = { Origin: new URL(page.url()).origin };
    const antes = (await (await page.request.get("/api/admin/estado")).json()).contato;
    // um segundo WhatsApp, fora do rodapé, só pra este teste
    const contato = { ...antes, zaps: [...antes.zaps, { id: "ze2e", nome: "WhatsApp - Teste", numero: "5512988887777", ativo: false }] };
    expect((await page.request.put("/api/admin/contato", { headers: origem, data: contato })).ok()).toBe(true);
    try {
      const titulo = `Preço e2e ${Date.now() % 100000}`;
      await abre(page, "festa");
      await page.reload();
      await expect(page.locator("#status")).not.toHaveAttribute("data-tipo", "carregando");
      await page.getByRole("button", { name: "Novo cartão" }).click();
      const previa = page.locator("#previaCartao .cz");
      await page.getByLabel("Título").fill(titulo);
      await expect(previa.locator("b")).toHaveText(titulo);
      await page.getByLabel("Descrição").fill("Teste de preço.");
      // sem preço: nada de etiqueta nem de opções de estilo
      await expect(previa.locator(".preco")).toHaveCount(0);
      await expect(page.locator("#precoEstilo")).toBeHidden();
      await expect(page.locator("#previaZap")).toContainText("(geral)");

      await page.getByLabel("WhatsApp deste cartão").selectOption({ label: "WhatsApp - Teste · (12) 98888-7777" });
      await expect(page.locator("#previaZap")).toHaveText("Abre o WhatsApp - Teste · (12) 98888-7777");
      await page.getByLabel("Preço (opcional)").fill("a partir de R$ 350");
      await expect(page.locator("#precoEstilo")).toBeVisible();
      await expect(previa.locator(".preco")).toHaveText("a partir de R$ 350");
      await expect(previa.locator(".preco")).toHaveClass("preco cor-tinta tam-m peso-forte");
      await page.getByRole("radio", { name: "Verde" }).check();
      await page.getByRole("radio", { name: "Grande" }).check();
      await page.getByRole("radio", { name: "Extra" }).check();
      await expect(previa.locator(".preco")).toHaveClass("preco cor-gravata tam-g peso-extra");
      await semProblemaGrave(page);
      await page.getByRole("button", { name: "Salvar cartão" }).click();
      await expect(page.locator("#aviso")).toContainText("Salvo");

      const item = page.locator(".cartao-item").filter({ hasText: titulo });
      await expect(item.locator(".preco")).toHaveText("a partir de R$ 350");
      await expect(item.locator(".cartao-zap")).toHaveText("Zap: WhatsApp - Teste");
      const salvo = (await (await page.request.get("/api/admin/estado")).json()).cartoes.find((c: { titulo: string }) => c.titulo === titulo);
      expect(salvo).toMatchObject({ zapId: "ze2e", preco: { texto: "a partir de R$ 350", cor: "gravata", tamanho: "g", peso: "extra" } });

      // editar: volta pro geral e tira o preço
      await page.getByRole("button", { name: `Editar ${titulo}` }).click();
      await expect(page.getByLabel("WhatsApp deste cartão")).toHaveValue("ze2e");
      await expect(page.getByRole("radio", { name: "Verde" })).toBeChecked();
      await page.getByLabel("WhatsApp deste cartão").selectOption("");
      await page.getByLabel("Preço (opcional)").fill("");
      await expect(previa.locator(".preco")).toHaveCount(0);
      await page.getByRole("button", { name: "Salvar cartão" }).click();
      await expect(page.locator("#aviso")).toContainText("Salvo");
      await expect(item.locator(".preco")).toHaveCount(0);
      await expect(item.locator(".cartao-zap")).toContainText("(geral)");

      await page.getByRole("button", { name: `Apagar ${titulo}` }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Apagar" }).click();
      await expect(item).toHaveCount(0);
    } finally {
      await page.request.put("/api/admin/contato", { headers: origem, data: antes });
    }
  });

  test("limites do cartão travam o Salvar", async ({ page }) => {
    await abre(page, "festa");
    await page.getByRole("button", { name: "Novo cartão" }).click();
    await page.getByLabel("Título").fill("x".repeat(41));
    await expect(page.getByRole("button", { name: "Salvar cartão" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancelar" }).click();
  });
});

test("todas as telas sem problema grave de acessibilidade", async ({ page }) => {
  for (const tela of ["inicio", "catalogo", "novidades", "banner", "festa", "contato"]) {
    await abre(page, tela);
    await semProblemaGrave(page);
  }
});
