import { criaPublicacao } from "../publicacoes.ts";
import { json, leJson } from "../resposta.ts";
import type { criaRoteador } from "../roteador.ts";

type Rota = ReturnType<typeof criaRoteador>["rota"];

const MOTIVOS_MANUAIS = new Set(["tentar-de-novo", "atualizar-catalogo"]);

export function registraAdmin(rota: Rota) {
  rota("GET", "/api/admin/estado", () => json({}));

  // "Tentar de novo" e "Atualizar catálogo"
  rota("POST", "/api/admin/publicar", async ({ req, env, deps }) => {
    const { motivo } = ((await leJson(req)) ?? {}) as { motivo?: string };
    const publicacao = await criaPublicacao(env, deps, motivo && MOTIVOS_MANUAIS.has(motivo) ? motivo : "manual");
    return json({ ok: true, publicacao });
  });
}
