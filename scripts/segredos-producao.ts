/**
 * `pnpm segredos:producao`: grava de uma vez os segredos de PRODUÇÃO.
 *   GitHub:     BUILD_TOKEN, PAINEL_URL
 *   Cloudflare: BUILD_TOKEN, ADMIN_EMAILS, GH_DISPATCH_TOKEN (wrangler pages secret put = produção)
 * Gera o BUILD_TOKEN (guarda em .segredos-producao.txt, fora do git, pra rodar de novo sem trocar) e pede
 * só o token fine-grained do GitHub (pode ser o mesmo do preview). Precisa do `gh` e do `wrangler login`.
 * Quem roda é o Gabriel.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const REPO = "Kaina-Ribeiro/ari-ribeiro-karaoke";
const PROJETO = "ari-ribeiro-karaoke";
const URL_PRODUCAO = "https://ari-ribeiro-karaoke.pages.dev";
const ARQUIVO = new URL("../.segredos-producao.txt", import.meta.url);
const WRANGLER = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const salvo = existsSync(ARQUIVO) ? /^[0-9a-f]{64}$/m.exec(readFileSync(ARQUIVO, "utf8"))?.[0] : undefined;
const buildToken = salvo ?? randomBytes(32).toString("hex");
if (!salvo) writeFileSync(ARQUIVO, `BUILD_TOKEN de produção (não commitar):\n${buildToken}\n`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const emails = (await rl.question("E-mails do painel, separados por vírgula [gabrielkaina99@gmail.com]: ")).trim() || "gabrielkaina99@gmail.com";
const ghToken = (await rl.question("Cole o token do GitHub (github_pat_...; pode ser o mesmo do preview): ")).trim();
rl.close();
if (!/^(github_pat_|ghp_)\w+$/.test(ghToken)) throw new Error("Isso não parece um token do GitHub (começa com github_pat_).");

const gh = (nome: string, valor: string) => {
  execFileSync("gh", ["secret", "set", nome, "--repo", REPO], { input: valor, stdio: ["pipe", "ignore", "inherit"] });
  console.log(`✅ GitHub: ${nome}`);
};
const cloudflare = (nome: string, valor: string) => {
  execFileSync(process.execPath, [WRANGLER, "pages", "secret", "put", nome, "--project-name", PROJETO], {
    input: valor, stdio: ["pipe", "ignore", "inherit"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  console.log(`✅ Cloudflare (produção): ${nome}`);
};

gh("BUILD_TOKEN", buildToken);
gh("PAINEL_URL", URL_PRODUCAO);
cloudflare("BUILD_TOKEN", buildToken);
cloudflare("ADMIN_EMAILS", emails);
cloudflare("GH_DISPATCH_TOKEN", ghToken);
console.log("\nPronto. Pode apagar o .segredos-preview.txt; guarde o .segredos-producao.txt só até o painel estar no ar.");
