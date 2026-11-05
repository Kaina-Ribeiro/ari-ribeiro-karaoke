import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const linhas = (page: Page) => page.locator("#lista .faixa-m");
const zap = async (page: Page, sel: string) => decodeURIComponent((await page.locator(sel).first().getAttribute("href")) ?? "");

/** Abre a página e espera o catálogo inteiro chegar (as abas só aparecem depois disso). */
async function abre(page: Page) {
  await page.goto("/");
  await expect(page.locator("#abas button")).toHaveCount(4);
}
const busca = (page: Page, q: string) => page.locator("#q").fill(q);

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a página já vem com músicas, serviços e prévia pro Zap", async ({ page }) => {
    await page.goto("/");
    await expect(linhas(page)).toHaveCount(50);
    await expect(page.locator(".cz")).not.toHaveCount(0);
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toMatch(/^https:\/\/.+\/img\/logo\.png$/);
  });

  test("o banner vem do painel, igual ao de antes", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#letreiro")).toHaveAttribute("aria-label", "Solta a voz, o palco é seu");
    await expect(page.locator("#letreiro .w")).toHaveText(["Solta", "a", "voz,", "o palco é", "seu."]);
    await expect(page.locator("#letreiro .w.serif")).toHaveText("o palco é");
    await expect(page.locator("#letreiro .w.ouro")).toHaveText("seu.");
    await expect(page.locator(".lede")).toHaveText("Acha a música, anota o código e manda pro KJ.");
    await expect(page.locator(".lede b")).toHaveText("código");
    await expect(page.locator(".poster .rodape")).toContainText("Com Ari");
    await expect(page.locator(".poster .area img")).toHaveAttribute("src", /^\/img\/painel\/\w+\.webp$/);
  });

  test("só o cartão com foto mostra foto, em 16:9", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".cz")).toHaveCount(4);
    await expect(page.locator(".cz img")).toHaveCount(1);
    const foto = page.locator(".cz").nth(3).locator("img.foto");
    await foto.scrollIntoViewIfNeeded();
    await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeTruthy();
    const box = (await foto.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
  });

  // fixture: geral = Ari (z1), Ana Paula (z2) recebe "Pedir música nova", KJ (z3) fora do rodapé recebe a comanda
  const GERAL = "5512991167274", ANA = "5512991196050", KJ = "5512981234567";

  test("rodapé: um bloco por WhatsApp ligado e por rede ligada, rótulo em cima e link embaixo", async ({ page }) => {
    await page.goto("/");
    const blocos = page.locator("#contato .contatos > div");
    await expect(blocos.locator("small")).toHaveText(["WhatsApp - Ari", "WhatsApp - Ana Paula", "Instagram", "Facebook", "Catálogo"]);
    await expect(page.locator("#contato a.num")).toHaveText(["(12) 99116-7274", "(12) 99119-6050"]);
    await expect(blocos.nth(2).locator("a")).toHaveText("@ariribeirokaraoke");
    await expect(blocos.nth(2).locator("a")).toHaveAttribute("href", "https://www.instagram.com/ariribeirokaraoke/");
    await expect(blocos.nth(3).locator("a")).toHaveAttribute("href", "https://www.facebook.com/ariribeirokaraoke");
    // TikTok desligado, Zap do KJ fora do rodapé e o rótulo antigo sumiram
    await expect(page.locator("#contato")).not.toContainText("TikTok");
    await expect(page.locator("#contato")).not.toContainText("Instagram e Facebook");
    await expect(page.locator(`#contato a[href*="${KJ}"]`)).toHaveCount(0);
    // rótulo em cima do link, no mesmo bloco
    const rot = (await blocos.nth(3).locator("small").boundingBox())!, link = (await blocos.nth(3).locator("a").boundingBox())!;
    expect(link.y).toBeGreaterThanOrEqual(rot.y + rot.height - 1);
    // nada vaza pro lado
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("todos os links wa.me da página vão pro número certo", async ({ page }) => {
    await page.goto("/");
    const links = await page.locator('a[href*="wa.me/"]').evaluateAll((as) => as.map((a) => ({
      onde: a.closest("#contato") ? "rodape" : a.closest(".cz") || a.classList.contains("cz") ? "cartao" : a.id === "mandar" ? "comanda" : "outro",
      numero: /wa\.me\/(\d+)/.exec(a.getAttribute("href")!)![1],
    })));
    expect(links.filter((l) => l.onde === "outro")).toEqual([]);
    expect(links.filter((l) => l.onde === "rodape").map((l) => l.numero)).toEqual([GERAL, ANA]);
    const cartoes = links.filter((l) => l.onde === "cartao");
    expect(cartoes.length).toBeGreaterThan(0);
    expect(cartoes.every((l) => l.numero === GERAL)).toBe(true);
    expect(links.filter((l) => l.onde === "comanda").map((l) => l.numero)).toEqual([KJ]);
    expect(await zap(page, ".cz")).toMatch(new RegExp(`^https://wa\\.me/${GERAL}\\?text=Oi Ari! Quero saber sobre: `));
  });
});

test.describe("busca e comanda sempre à mão", () => {
  test.beforeEach(async ({ page }) => abre(page));
  const rolaPraLista = (page: Page) =>
    page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; scrollTo(0, document.querySelector<HTMLElement>(".catalogo")!.offsetTop + 800); });

  test("a busca aparece na primeira tela", async ({ page }) => {
    await expect(page.locator("#q")).toBeInViewport();
  });

  test("ao rolar a lista, a busca gruda no topo e a comanda continua na tela", async ({ page }) => {
    await rolaPraLista(page);
    await expect(page.locator("#q")).toBeInViewport();
    await expect(page.locator("#abreComanda")).toBeInViewport();
    const barra = (await page.locator(".busca").boundingBox())!;
    expect(barra.y).toBeLessThanOrEqual(1);
    // o A–Z gruda logo abaixo, sem fresta (no celular ele é uma linha)
    const az = (await page.locator("#az").boundingBox())!;
    if (az.height < 100) expect(Math.abs(az.y - barra.height)).toBeLessThanOrEqual(2);
  });

  test("a comanda fixa fica embaixo e não esconde o fim da página", async ({ page }) => {
    const c = (await page.locator("#abreComanda").boundingBox())!;
    expect(c.y + c.height).toBeGreaterThan(page.viewportSize()!.height - 40);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; scrollTo(0, document.body.scrollHeight); });
    const ultimo = (await page.locator(".contatos").boundingBox())!;
    expect(ultimo.y + ultimo.height).toBeLessThanOrEqual(c.y);
  });

  test("o botão da comanda diz o que é", async ({ page }) => {
    await expect(page.locator("#abreComanda .rot")).toBeVisible();
    await expect(page.locator("#abreComanda")).toHaveAccessibleName(/comanda/i);
  });

  test("Limpar aparece com a busca e esvazia o campo", async ({ page }) => {
    await expect(page.locator("#limpa")).toBeHidden();
    await busca(page, "abba");
    await expect(page.locator("#limpa")).toBeVisible();
    await page.locator("#limpa").click();
    await expect(page.locator("#q")).toHaveValue("");
    await expect(page.locator("#limpa")).toBeHidden();
  });
});

test.describe("busca", () => {
  test.beforeEach(async ({ page }) => abre(page));

  test("carrega o catálogo inteiro e pagina", async ({ page }) => {
    const total: number = JSON.parse((await page.locator("#manifesto").textContent())!).total;
    expect(total).toBeGreaterThan(50);
    await expect(page.locator("#contaCat")).toHaveText(`${total} músicas`);
    const primeira = await linhas(page).first().getAttribute("data-cod");
    await page.getByRole("button", { name: "Próxima →" }).click();
    await expect(linhas(page)).toHaveCount(total - 50);
    await expect(linhas(page).first()).not.toHaveAttribute("data-cod", primeira!);
  });

  test("código exato abre a telinha com o pedido pronto", async ({ page }) => {
    await busca(page, "4973");
    await expect(page.locator(".telinha .big")).toHaveText("4973");
    await expect(page.locator(".telinha .nome")).toContainText("Take on Me");
    expect(await zap(page, ".telinha a.zap")).toContain("4973 · Take on Me");
    expect(await zap(page, ".telinha a.zap")).toMatch(/^https:\/\/wa\.me\/5512981234567\?/); // "Pedir pro KJ"
    // só existe essa com esse código: nada de tabela vazia embaixo da telinha
    await expect(page.locator("#lista .tabela")).toHaveCount(0);
  });

  test("acha sem acento e com erro de digitação", async ({ page }) => {
    await busca(page, "tak on me");
    await expect(linhas(page).first().locator(".tit")).toContainText("Take on Me");
    await busca(page, "cancao");
    await expect(linhas(page).first().locator(".tit")).toContainText("Canção pra Não Voltar");
  });

  test("acha pelo começo da letra e grifa o trecho", async ({ page }) => {
    await busca(page, "nao volte pra casa");
    await expect(linhas(page).first().locator(".tit")).toContainText("Canção pra Não Voltar");
    await expect(linhas(page).first().locator(".let mark")).toHaveText("Não volte pra casa");
  });

  test("o mesmo cantor escrito de jeitos diferentes aparece como um só", async ({ page }) => {
    await busca(page, "guns");
    await expect(linhas(page)).toHaveCount(8);
    expect(new Set(await linhas(page).locator(".art").allTextContents())).toEqual(new Set(["Guns n’ Roses"]));
  });

  test("marcador da planilha não aparece como letra", async ({ page }) => {
    await busca(page, "lay all your love");
    await expect(linhas(page).first().locator(".let")).toHaveClass(/vazia/);
    await busca(page, "me and mr jones");
    await expect(linhas(page).first().locator(".let")).toHaveClass(/vazia/);
  });

  test("sem resultado oferece pedir a música pro Ari", async ({ page }) => {
    await busca(page, "zzzzqqq");
    await expect(page.locator(".vazio h3")).toHaveText("Essa ainda não tem");
    expect(await zap(page, ".vazio a.zap")).toContain("não achei no catálogo: zzzzqqq");
    // pedido de música nova vai pro WhatsApp escolhido no painel (na fixture, a Ana Paula), não pro KJ nem pro geral
    expect(await zap(page, ".vazio a.zap")).toMatch(/^https:\/\/wa\.me\/5512991196050\?/);
  });

  test("busca vazia num filtro oferece procurar em todas", async ({ page }) => {
    await page.locator('#abas [data-f="exc"]').click();
    await busca(page, "take on me");
    await expect(page.locator(".vazio")).toContainText("Só no Ari");
    await page.locator('.vazio [data-f="todas"]').click();
    await expect(linhas(page).first().locator(".tit")).toContainText("Take on Me");
  });

  test("filtros sem contagem e mostrando só o que prometem", async ({ page }) => {
    await expect(page.locator("#abas button")).toHaveText(["Todas", "★ Favoritas", "Novidades", "Só no Ari"]);
    for (const [f, tag] of [["exc", ".tag.exc"], ["nova", ".tag.nova"]]) {
      await page.locator(`#abas [data-f="${f}"]`).click();
      await expect(page.locator(`#abas [data-f="${f}"]`)).toHaveAttribute("aria-pressed", "true");
      // a contagem do filtro fica no título
      const n = Number((await page.locator("#contaCat").textContent())!.replace(/\D/g, ""));
      expect(n).toBeGreaterThan(0);
      await expect(linhas(page)).toHaveCount(Math.min(n, 50));
      await expect(linhas(page).locator(tag)).toHaveCount(Math.min(n, 50));
    }
  });

  test("tocar no cantor busca as músicas dele", async ({ page }) => {
    const art = linhas(page).first().locator(".art");
    const nome = (await art.textContent())!;
    await art.click();
    await expect(page.locator("#q")).toHaveValue(nome);
    expect(new Set(await linhas(page).locator(".art").allTextContents())).toEqual(new Set([nome]));
  });

  test("A–Z pula pro cantor, mesmo em outra página", async ({ page }) => {
    await page.locator('#az a[data-letra="N"]').click();
    await expect(page.locator("#letra-N")).toBeInViewport();
    await expect(page.getByText("NSYNC").first()).toBeVisible();
  });

  test("A–Z só oferece letras que existem no filtro", async ({ page }) => {
    await page.locator('#abas [data-f="exc"]').click();
    await expect(page.locator('#az a[data-letra="N"]')).toHaveCount(0);
    await expect(page.locator('#az a[data-letra="#"]')).toHaveCount(1);
  });

  test("atalho / leva pra busca", async ({ page, isMobile }) => {
    test.skip(isMobile, "atalho de teclado");
    await page.locator("body").press("/");
    await expect(page.locator("#q")).toBeFocused();
  });
});

test.describe("favoritas e comanda", () => {
  test.beforeEach(async ({ page }) => abre(page));

  test("favorita fica salva no aparelho", async ({ page }) => {
    const linha = linhas(page).first();
    const cod = await linha.getAttribute("data-cod");
    await linha.locator(".fav").click();
    await expect(linhas(page).first().locator(".fav")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await page.locator('#abas [data-f="fav"]').click();
    await expect(linhas(page)).toHaveCount(1);
    await expect(linhas(page).first()).toHaveAttribute("data-cod", cod!);
    await linhas(page).first().locator(".fav").click();
    await expect(page.locator(".vazio h3")).toHaveText("Nenhuma favorita ainda");
  });

  test("comanda anota, manda pro Zap com o nome e sobrevive ao recarregar", async ({ page }) => {
    const cods = [await linhas(page).nth(0).getAttribute("data-cod"), await linhas(page).nth(1).getAttribute("data-cod")];
    await linhas(page).nth(0).locator(".mais").click();
    await linhas(page).nth(1).locator(".mais").click();
    await expect(page.locator("#nComanda")).toHaveText("2");
    await expect(linhas(page).nth(0)).toHaveClass(/na-comanda/);

    await page.locator("#abreComanda").click();
    await expect(page.locator("#comanda")).toHaveClass(/on/);
    await expect(page.locator("#itens li")).toHaveCount(2);
    await page.locator("#cantor").fill("Gabi");
    const msg = await zap(page, "#mandar");
    expect(msg).toContain("Gabi quer cantar");
    for (const c of cods) expect(msg).toContain(`• ${c} · `);

    await page.locator("#itens [data-tira]").first().click();
    await expect(page.locator("#itens li")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("#comanda")).not.toHaveClass(/on/);

    await page.reload();
    await expect(page.locator("#nComanda")).toHaveText("1");
  });

  test("comanda vazia não manda pro Zap; com 1 música, manda", async ({ page }) => {
    const mandar = page.locator("#mandar");
    await page.locator("#abreComanda").click();
    await expect(mandar).toHaveAttribute("aria-disabled", "true");
    await expect(mandar).not.toHaveAttribute("href", /.*/);
    // aria-disabled faz o Playwright esperar pra sempre; quem usa consegue tocar, então força
    // (depois que a comanda termina de descer na tela)
    await expect(mandar).toBeInViewport({ ratio: 1 });
    await mandar.click({ force: true });
    await expect(page.locator("#aviso")).toHaveText("Põe pelo menos 1 música na comanda");
    await page.keyboard.press("Escape");

    await linhas(page).first().locator(".mais").click();
    await page.locator("#abreComanda").click();
    await expect(mandar).not.toHaveAttribute("aria-disabled", /.*/);
    expect(await zap(page, "#mandar")).toContain("Quero cantar");
    // a comanda vai pro Zap do KJ (na fixture, diferente do de contato)
    expect(await zap(page, "#mandar")).toMatch(/^https:\/\/wa\.me\/5512981234567\?/);

    // tirou a última: trava de novo
    await page.locator("#itens [data-tira]").first().click();
    await expect(mandar).toHaveAttribute("aria-disabled", "true");
  });

  test("abrir e fechar a comanda cuida do foco", async ({ page }) => {
    const fecha = page.locator("#fechaComanda");
    // fechada: fora da tela e fora do Tab
    expect(await fecha.evaluate((b: HTMLElement) => { b.focus(); return document.activeElement === b; })).toBe(false);
    await page.locator("#abreComanda").click();
    await expect(fecha).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#abreComanda")).toBeFocused();
  });

  test("comanda fechada não aparece ao redimensionar a janela", async ({ page }) => {
    const comanda = page.locator("#comanda");
    await expect(comanda).toBeHidden();
    // passa do layout de computador pro de celular e volta: ela troca de lado, mas fechada continua invisível
    for (const largura of [1000, 600, 1000]) {
      await page.setViewportSize({ width: largura, height: 800 });
      await expect(comanda).toBeHidden();
    }
    await page.locator("#abreComanda").click();
    await expect(comanda).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(comanda).toBeHidden();
  });

  test("localStorage estragado não derruba a página", async ({ page }) => {
    await page.evaluate(() => { localStorage.setItem("ari.comanda", '{"x":1}'); localStorage.setItem("ari.favoritas", "42"); });
    await page.reload();
    await expect(page.locator("#abas button")).toHaveCount(4);
    await expect(page.locator("#nComanda")).toHaveText("0");
  });

  test("tocar na linha copia o código", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "permissão de área de transferência só no Chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const linha = linhas(page).first();
    await linha.locator(".tit").click();
    await expect(linha).toHaveClass(/copiou/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await linha.getAttribute("data-cod"));
  });
});

test.describe("qualidade", () => {
  test("sem erro no console", async ({ page }) => {
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") erros.push(m.text()); });
    await abre(page);
    await busca(page, "amor");
    await expect(page.locator("#tituloCat")).toContainText("Achamos");
    expect(erros).toEqual([]);
  });

  test("nada estoura a largura da tela", async ({ page, isMobile }) => {
    await abre(page);
    const larguras = isMobile ? [page.viewportSize()!.width] : [320, 375, 768, 1024, 1440];
    for (const w of larguras) {
      await page.setViewportSize({ width: w, height: 800 });
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra, `largura ${w}px`).toBeLessThanOrEqual(0);
    }
  });

  test("acessibilidade: sem problema grave (axe, WCAG AA)", async ({ page }) => {
    await abre(page);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(graves.map((v) => `${v.id}: ${v.nodes.length}x ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test("acessibilidade: comanda aberta", async ({ page }) => {
    await abre(page);
    await linhas(page).first().locator(".mais").click();
    await page.locator("#abreComanda").click();
    await expect(page.locator("#comanda")).toHaveClass(/on/);
    const r = await new AxeBuilder({ page }).include("#comanda").withTags(["wcag2a", "wcag2aa"]).analyze();
    const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(graves.map((v) => `${v.id}: ${v.nodes.length}x ${v.nodes[0]?.target}`)).toEqual([]);
  });
});
