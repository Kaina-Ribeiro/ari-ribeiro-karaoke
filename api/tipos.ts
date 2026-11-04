import type { D1Database, R2Bucket } from "@cloudflare/workers-types/index.ts";
import type { JWTVerifyGetKey } from "jose";

export interface Env {
  DB: D1Database;
  ARQUIVOS: R2Bucket;
  /** e-mails que podem entrar no painel, separados por vírgula */
  ADMIN_EMAILS: string;
  ACCESS_TEAM?: string;
  ACCESS_AUD?: string;
  /** login de teste: só vale quando o host da requisição é localhost */
  DEV_ADMIN_EMAIL?: string;
  BUILD_TOKEN: string;
  GH_DISPATCH_TOKEN?: string;
  GH_REPO?: string;
  /** branch que o workflow publica: "main" (produção) ou "painel" (preview) */
  GH_REF?: string;
}

/** O que vem de fora (relógio, rede, chaves), separado pra dar pra testar. */
export interface Deps {
  chaves(env: Env): JWTVerifyGetKey;
  agora(): Date;
  fetch: typeof fetch;
  aleatorio(): string;
}
