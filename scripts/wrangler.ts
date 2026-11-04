/** Roda o wrangler do projeto sem passar por shell (sem problema de aspas no Windows). */
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const ENV = { ...process.env, WRANGLER_SEND_METRICS: "false" };

export function wrangler(args: string[]): void {
  execFileSync(process.execPath, [BIN, ...args], { cwd: RAIZ, stdio: "inherit", env: ENV });
}

/** Processo que fica no ar (pages dev). */
export function wranglerNoAr(args: string[]) {
  return spawn(process.execPath, [BIN, ...args], { cwd: RAIZ, stdio: "inherit", env: ENV });
}
