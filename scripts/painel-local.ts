/**
 * `pnpm painel`: tudo local num comando só, do zero a cada vez.
 *   banco limpo (.wrangler/painel) → importação com a fixture → build offline → wrangler pages dev em :8788
 * Login de teste: DEV_ADMIN_EMAIL do .dev.vars (criado do .dev.vars.example se não existir), só em localhost.
 * Site em http://localhost:8788, painel em http://localhost:8788/admin.
 * Outra porta (duas worktrees ao mesmo tempo): PAINEL_PORTA=8790 pnpm painel, com banco próprio em .wrangler/painel-8790.
 */
import { execFileSync } from "node:child_process";
import { copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wranglerNoAr } from "./wrangler.ts";

const raiz = (c: string) => fileURLToPath(new URL("../" + c, import.meta.url));
const node = (script: string, ...args: string[]) => execFileSync(process.execPath, [raiz(script), ...args], { cwd: raiz(""), stdio: "inherit" });

const PORTA = process.env.PAINEL_PORTA ?? "8788";
const PASTA = PORTA === "8788" ? ".wrangler/painel" : `.wrangler/painel-${PORTA}`;
process.env.PAINEL_PASTA = PASTA; // o importa.ts grava no mesmo banco

await rm(raiz(PASTA), { recursive: true, force: true });
if (!existsSync(raiz(".dev.vars"))) await copyFile(raiz(".dev.vars.example"), raiz(".dev.vars"));

node("scripts/importa.ts", "--alvo", "local", "--offline");
node("scripts/planilha.ts", "--offline");
node("node_modules/astro/bin/astro.mjs", "build");

const dev = wranglerNoAr(["pages", "dev", "dist", "--port", PORTA, "--persist-to", PASTA]);
for (const sinal of ["SIGINT", "SIGTERM"] as const) process.on(sinal, () => { dev.kill(); process.exit(0); });
dev.on("exit", (code) => process.exit(code ?? 0));
