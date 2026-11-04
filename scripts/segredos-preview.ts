/**
 * `pnpm segredos:preview`: grava no GitHub os dois segredos do preview (BUILD_TOKEN_PREVIEW e PAINEL_URL_PREVIEW)
 * com o token do .segredos-preview.txt, e copia esse token pra área de transferência, pra colar na Cloudflare.
 * Precisa do `gh` logado. Quem roda é o Gabriel.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO = "Kaina-Ribeiro/ari-ribeiro-karaoke";
const URL_PREVIEW = "https://painel.ari-ribeiro-karaoke.pages.dev";

const arquivo = readFileSync(new URL("../.segredos-preview.txt", import.meta.url), "utf8");
const token = /^[0-9a-f]{64}$/m.exec(arquivo)?.[0];
if (!token) throw new Error("Não achei o token em .segredos-preview.txt.");

const gh = (nome: string, valor: string) => {
  execFileSync("gh", ["secret", "set", nome, "--repo", REPO], { input: valor, stdio: ["pipe", "inherit", "inherit"] });
  console.log(`✅ GitHub: ${nome}`);
};
gh("BUILD_TOKEN_PREVIEW", token);
gh("PAINEL_URL_PREVIEW", URL_PREVIEW);

if (process.platform === "win32") {
  execFileSync("clip", { input: token });
  console.log("\n📋 O BUILD_TOKEN já está copiado. Cole na Cloudflare (Preview) com Ctrl+V.");
} else {
  console.log(`\nBUILD_TOKEN pra Cloudflare: ${token}`);
}
console.log("\nNa Cloudflare → Workers & Pages → ari-ribeiro-karaoke → Settings → Variables and Secrets → Preview → Add (Secret):");
console.log("  BUILD_TOKEN       = Ctrl+V");
console.log("  ADMIN_EMAILS      = gabrielkaina99@gmail.com");
console.log("  GH_DISPATCH_TOKEN = o token fine-grained do GitHub");
