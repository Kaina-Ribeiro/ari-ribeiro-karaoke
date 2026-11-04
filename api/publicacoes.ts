/**
 * Cada "Salvar" vira uma publicação: pede o build ao GitHub Actions e acompanha até ficar no ar.
 * pendente → rodando → ok | falhou
 */
import { ErroHttp } from "./resposta.ts";
import type { Deps, Env } from "./tipos.ts";

export type StatusPublicacao = "pendente" | "rodando" | "ok" | "falhou";

export interface Publicacao {
  id: number;
  motivo: string;
  status: StatusPublicacao;
  erro: string | null;
  runUrl: string | null;
  musicas: number | null;
  pedidoEm: string;
  terminouEm: string | null;
}

interface Linha { id: number; motivo: string; status: StatusPublicacao; erro: string | null; run_url: string | null; musicas: number | null; pedido_em: string; terminou_em: string | null }

const deLinha = (r: Linha): Publicacao => ({
  id: r.id, motivo: r.motivo, status: r.status, erro: r.erro, runUrl: r.run_url, musicas: r.musicas, pedidoEm: r.pedido_em, terminouEm: r.terminou_em,
});

export async function lePublicacao(env: Env, id: number): Promise<Publicacao | null> {
  const r = await env.DB.prepare("SELECT * FROM publicacoes WHERE id = ?").bind(id).first<Linha>();
  return r ? deLinha(r) : null;
}

export async function ultimaPublicacao(env: Env): Promise<Publicacao | null> {
  const r = await env.DB.prepare("SELECT * FROM publicacoes ORDER BY id DESC LIMIT 1").first<Linha>();
  return r ? deLinha(r) : null;
}

/** Músicas da última publicação que deu certo: base da trava contra arquivo errado. */
export async function musicasNoAr(env: Env): Promise<number | null> {
  const r = await env.DB.prepare("SELECT musicas FROM publicacoes WHERE status = 'ok' AND musicas IS NOT NULL ORDER BY id DESC LIMIT 1").first<{ musicas: number }>();
  return r?.musicas ?? null;
}

export async function criaPublicacao(env: Env, deps: Deps, motivo: string): Promise<Publicacao> {
  const r = await env.DB.prepare("INSERT INTO publicacoes (motivo, status, pedido_em) VALUES (?, 'pendente', ?) RETURNING id")
    .bind(motivo, deps.agora().toISOString()).first<{ id: number }>();
  await disparaBuild(env, deps, r!.id);
  return (await lePublicacao(env, r!.id))!;
}

async function falha(env: Env, deps: Deps, id: number, erro: string) {
  await env.DB.prepare("UPDATE publicacoes SET status = 'falhou', erro = ?, terminou_em = ? WHERE id = ?")
    .bind(erro.slice(0, 500), deps.agora().toISOString(), id).run();
}

/** Pede o build ao GitHub. Sem token (dev), só marca como publicada. */
export async function disparaBuild(env: Env, deps: Deps, id: number): Promise<void> {
  if (!env.GH_DISPATCH_TOKEN) {
    await env.DB.prepare("UPDATE publicacoes SET status = 'ok', erro = 'simulado em dev', terminou_em = ? WHERE id = ?")
      .bind(deps.agora().toISOString(), id).run();
    return;
  }
  const repo = env.GH_REPO || "Kaina-Ribeiro/ari-ribeiro-karaoke";
  try {
    const r = await deps.fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "ari-painel",
      },
      body: JSON.stringify({ event_type: "publicar", client_payload: { publicacao: id } }),
    });
    if (!r.ok) await falha(env, deps, id, `Não consegui pedir a publicação ao GitHub (HTTP ${r.status}).`);
  } catch {
    await falha(env, deps, id, "Não consegui pedir a publicação ao GitHub (sem conexão).");
  }
}

export interface CorpoStatus { publicacao?: number; status: "rodando" | "ok" | "falhou"; erro?: string; runUrl?: string; musicas?: number }

export function validaCorpoStatus(x: unknown): CorpoStatus {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  if (o.status !== "rodando" && o.status !== "ok" && o.status !== "falhou") throw new ErroHttp("status precisa ser rodando, ok ou falhou", 400);
  const inteiro = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
  return {
    status: o.status,
    publicacao: inteiro(o.publicacao),
    erro: typeof o.erro === "string" ? o.erro : undefined,
    runUrl: typeof o.runUrl === "string" ? o.runUrl.slice(0, 300) : undefined,
    musicas: inteiro(o.musicas),
  };
}

/**
 * Uma publicação que deu certo cobre as anteriores ainda abertas (o Actions cancela as da fila).
 * O "publicar mesmo com menos músicas" não é apagado aqui: ele é do arquivo confirmado (sai quando o Ari
 * envia outro arquivo sem confirmar). Depois do primeiro ok, as músicas no ar já são as do arquivo novo e a
 * trava não dispara mais; apagar aqui deixaria uma publicação antiga gastar a confirmação de uma nova.
 */
async function terminaOk(env: Env, agora: string, id: number) {
  await env.DB.prepare("UPDATE publicacoes SET status = 'ok', terminou_em = ? WHERE id < ? AND status IN ('pendente', 'rodando')")
    .bind(agora, id).run();
}

export async function registraStatus(env: Env, deps: Deps, c: CorpoStatus): Promise<{ publicacao: number; ignorada?: true }> {
  const agora = deps.agora().toISOString();
  const final = c.status !== "rodando";
  let id = c.publicacao;
  if (id === undefined) {
    const r = await env.DB.prepare("INSERT INTO publicacoes (motivo, status, pedido_em) VALUES ('diaria', 'pendente', ?) RETURNING id")
      .bind(agora).first<{ id: number }>();
    id = r!.id;
  } else {
    const p = await lePublicacao(env, id);
    if (!p) throw new ErroHttp("Publicação não encontrada", 404);
    if (p.status === "ok" || p.status === "falhou") return { publicacao: id, ignorada: true };
  }
  await env.DB.prepare(
    "UPDATE publicacoes SET status = ?, erro = ?, run_url = COALESCE(?, run_url), musicas = COALESCE(?, musicas), terminou_em = ? WHERE id = ?",
  ).bind(c.status, c.status === "falhou" ? (c.erro ?? "O build falhou.").slice(0, 500) : null, c.runUrl ?? null, c.musicas ?? null, final ? agora : null, id).run();
  if (c.status === "ok") await terminaOk(env, agora, id);
  return { publicacao: id };
}
