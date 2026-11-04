/**
 * `pnpm painel`: tudo local num comando só, do zero a cada vez.
 *   banco limpo (.wrangler/painel) → importação com a fixture → build offline → wrangler pages dev em :8788
 * Login de teste: DEV_ADMIN_EMAIL do .dev.vars (criado do .dev.vars.example se não existir), só em localhost.
 * Site em http://localhost:8788, painel em http://localhost:8788/admin.
 */
import { execFileSync } from "node:child_process";
import { copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wranglerNoAr } from "./wrangler.ts";

const raiz = (c: string) => fileURLToPath(new URL("../" + c, import.meta.url));
const node = (script: string, ...args: string[]) => execFileSync(process.execPath, [raiz(script), ...args], { cwd: raiz(""), stdio: "inherit" });

await rm(raiz(".wrangler/painel"), { recursive: true, force: true });
if (!existsSync(raiz(".dev.vars"))) await copyFile(raiz(".dev.vars.example"), raiz(".dev.vars"));

node("scripts/importa.ts", "--alvo", "local", "--offline");
node("scripts/planilha.ts", "--offline");
node("node_modules/astro/bin/astro.mjs", "build");

const dev = wranglerNoAr(["pages", "dev", "dist", "--port", "8788", "--persist-to", ".wrangler/painel"]);
for (const sinal of ["SIGINT", "SIGTERM"] as const) process.on(sinal, () => { dev.kill(); process.exit(0); });
dev.on("exit", (code) => process.exit(code ?? 0));
