import { jwtVerify } from "jose";
import { erro } from "./resposta.ts";
import type { Deps, Env } from "./tipos.ts";

const LOCAL = new Set(["localhost", "127.0.0.1"]);
const naoLogado = () => erro("Faça login de novo.", 401);

/**
 * O Cloudflare Access já barra quem não está na política; aqui conferimos de novo o JWT que ele manda
 * (assinatura, aud do ambiente, validade) e o e-mail na lista. Defesa em profundidade, caso o Access
 * esteja mal configurado num ambiente.
 */
export async function exigeAdmin(req: Request, env: Env, deps: Deps): Promise<{ email: string } | Response> {
  // login de teste: só na máquina de quem desenvolve, nunca num host da Cloudflare
  if (env.DEV_ADMIN_EMAIL && LOCAL.has(new URL(req.url).hostname)) return { email: env.DEV_ADMIN_EMAIL };
  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || !env.ACCESS_TEAM || !env.ACCESS_AUD) return naoLogado();
  try {
    const { payload } = await jwtVerify(jwt, deps.chaves(env), {
      issuer: `https://${env.ACCESS_TEAM}.cloudflareaccess.com`,
      audience: env.ACCESS_AUD,
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    const lista = env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    return email && lista.includes(email) ? { email } : naoLogado();
  } catch {
    return naoLogado();
  }
}

/** Compara sem sair cedo, pra o tempo de resposta não revelar quantos caracteres bateram. */
function iguais(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  for (let i = 0; i < ea.length; i++) dif |= ea[i] ^ (eb[i % (eb.length || 1)] ?? 0);
  return dif === 0;
}

export function exigeBuild(req: Request, env: Env): true | Response {
  const token = /^Bearer (.+)$/.exec(req.headers.get("Authorization") ?? "")?.[1] ?? "";
  if (!env.BUILD_TOKEN || !token || !iguais(token, env.BUILD_TOKEN)) return erro("Token do build inválido.", 401);
  return true;
}

const MUTACOES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Mutações só do próprio site e só com corpo JSON ou multipart (barra formulário de outro site). */
export function confereOrigem(req: Request): true | Response {
  if (!MUTACOES.has(req.method)) return true;
  if (req.headers.get("Origin") !== new URL(req.url).origin) return erro("Origem não permitida.", 403);
  const tipo = (req.headers.get("Content-Type") ?? "").toLowerCase();
  if (!tipo.startsWith("application/json") && !tipo.startsWith("multipart/form-data")) return erro("Envie os dados como JSON.", 415);
  return true;
}
