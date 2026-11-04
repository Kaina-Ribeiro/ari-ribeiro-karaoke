import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { handle } from "../../api/app.ts";
import type { Deps, Env } from "../../api/tipos.ts";

/** Separa o SQL da migração em instruções (D1 roda uma por prepare). */
export function instrucoes(sql: string): string[] {
  return sql.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
}

export const BUILD_TOKEN_TESTE = "b".repeat(64);

/** D1 e R2 locais (Miniflare, em memória) com a migração aplicada. */
export async function criaAmbiente(opcoes: { env?: Partial<Env> } = {}) {
  const mf = new Miniflare({
    workers: [{
      name: "painel",
      modules: true,
      script: "export default { fetch() { return new Response('') } }",
      d1Databases: ["DB"],
      r2Buckets: ["ARQUIVOS"],
    }],
  });
  const DB = (await mf.getD1Database("DB")) as unknown as Env["DB"];
  const ARQUIVOS = (await mf.getR2Bucket("ARQUIVOS")) as unknown as Env["ARQUIVOS"];
  const sql = await readFile(new URL("../../migrations/0001_inicial.sql", import.meta.url), "utf8");
  await DB.batch(instrucoes(sql).map((s) => DB.prepare(s)));
  const env: Env = { DB, ARQUIVOS, ADMIN_EMAILS: "gabriel@painel.test", BUILD_TOKEN: BUILD_TOKEN_TESTE, ...opcoes.env };
  return {
    env,
    chamar: (req: Request, deps?: Partial<Deps>) => handle(req, env, deps),
    fecha: () => mf.dispose(),
  };
}
