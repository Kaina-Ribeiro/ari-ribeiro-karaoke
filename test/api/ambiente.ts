import { readdir, readFile } from "node:fs/promises";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { Miniflare } from "miniflare";
import { handle } from "../../api/app.ts";
import type { Deps, Env } from "../../api/tipos.ts";

/** Separa o SQL da migração em instruções (D1 roda uma por prepare). */
export function instrucoes(sql: string): string[] {
  return sql.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
}

export const BUILD_TOKEN_TESTE = "b".repeat(64);
export const ADMIN = "gabriel@painel.test";
export const SITE = "https://ari-ribeiro-karaoke.pages.dev";
const TIME = "time-teste";
const AUD = "aud-teste";

// um par de chaves por execução, no lugar das chaves públicas do Cloudflare Access
const par = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(par.publicKey)), kid: "teste", alg: "RS256" };
export const chavesDeTeste: JWTVerifyGetKey = createLocalJWKSet({ keys: [jwk] });

/** JWT como o Access manda no cabeçalho Cf-Access-Jwt-Assertion. */
export function jwtDeTeste(email: string, opcoes: { aud?: string; expirado?: boolean } = {}): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "teste" })
    .setIssuer(`https://${TIME}.cloudflareaccess.com`)
    .setAudience(opcoes.aud ?? AUD)
    .setIssuedAt(agora - 3600)
    .setExpirationTime(opcoes.expirado ? agora - 60 : agora + 3600)
    .sign(par.privateKey);
}

/** Requisição de admin já logada (JWT válido e Origin do próprio site). */
export async function reqAdmin(metodo: string, caminho: string, corpo?: unknown, email = ADMIN): Promise<Request> {
  const headers: Record<string, string> = { "Cf-Access-Jwt-Assertion": await jwtDeTeste(email), Origin: SITE };
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  else if (metodo !== "GET") headers["Content-Type"] = "application/json";
  return new Request(SITE + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
}

export const reqBuild = (metodo: string, caminho: string, corpo?: unknown) =>
  new Request(SITE + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${BUILD_TOKEN_TESTE}`, ...(corpo === undefined ? {} : { "Content-Type": "application/json" }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

/** D1 e R2 locais (Miniflare, em memória) com a migração aplicada. */
export async function criaAmbiente(opcoes: { env?: Partial<Env>; deps?: Partial<Deps> } = {}) {
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
  // todas as migrações, na ordem do nome (como o wrangler d1 migrations apply)
  const pasta = new URL("../../migrations/", import.meta.url);
  for (const arquivo of (await readdir(pasta)).filter((a) => a.endsWith(".sql")).sort()) {
    const sql = await readFile(new URL(arquivo, pasta), "utf8");
    await DB.batch(instrucoes(sql).map((s) => DB.prepare(s)));
  }
  const env: Env = {
    DB, ARQUIVOS, ADMIN_EMAILS: `${ADMIN}, ari@painel.test`, ACCESS_TEAM: TIME, ACCESS_AUD: AUD, BUILD_TOKEN: BUILD_TOKEN_TESTE,
    ...opcoes.env,
  };
  const depsBase: Partial<Deps> = { chaves: () => chavesDeTeste, ...opcoes.deps };
  return {
    env,
    chamar: (req: Request, deps?: Partial<Deps>) => handle(req, env, { ...depsBase, ...deps }),
    fecha: () => mf.dispose(),
  };
}
