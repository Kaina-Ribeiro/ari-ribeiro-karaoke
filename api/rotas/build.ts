import { chavePacote, classifica, hojeSP } from "../../src/lib/painel/classifica.ts";
import type { ConfigBuild } from "../../src/lib/painel/tipos.ts";
import type { Pacote } from "../../src/lib/texto.ts";
import { leConfig, listaCartoes, listaPacotes } from "../config.ts";
import { musicasNoAr, registraStatus, validaCorpoStatus } from "../publicacoes.ts";
import { ErroHttp, json, leJson } from "../resposta.ts";
import type { criaRoteador } from "../roteador.ts";
import { serveArquivo } from "./arquivos.ts";

type Rota = ReturnType<typeof criaRoteador>["rota"];

export function registraBuild(rota: Rota) {
  rota("GET", "/api/build/config", async ({ env, deps }) => {
    const [contato, banner, catalogo, novidades, dicas, cartoes, pacotes, noAr] = await Promise.all([
      leConfig(env, "contato"), leConfig(env, "banner"), leConfig(env, "catalogo"), leConfig(env, "novidades"), leConfig(env, "dicas"),
      listaCartoes(env, { soAtivos: true }), listaPacotes(env), musicasNoAr(env),
    ]);
    const config: ConfigBuild = { contato, banner, catalogo, novidades, dicas, cartoes, pacotes, musicasNoAr: noAr, hoje: hojeSP(deps.agora()) };
    return json(config);
  });

  rota("GET", "/api/build/arquivo/:chave*", ({ env, params }) => serveArquivo(env, params.chave));

  /** O build conta os pacotes da planilha; pacote novo ganha a data de hoje como chegada. */
  rota("POST", "/api/build/pacotes", async ({ req, env, deps }) => {
    const { pacotes } = ((await leJson(req)) ?? {}) as { pacotes?: unknown };
    if (!Array.isArray(pacotes)) throw new ErroHttp("Mande {pacotes: [{nome, musicas}]}", 400);
    const porChave = new Map<string, { nome: string; musicas: number }>();
    for (const p of pacotes as { nome?: unknown; musicas?: unknown }[]) {
      const nome = typeof p?.nome === "string" ? p.nome.trim() : "";
      const chave = chavePacote(nome);
      if (!chave) continue; // sem pacote = catálogo base
      const musicas = typeof p.musicas === "number" && p.musicas >= 0 ? Math.floor(p.musicas) : 0;
      const ja = porChave.get(chave);
      porChave.set(chave, { nome: ja?.nome ?? nome, musicas: (ja?.musicas ?? 0) + musicas });
    }
    const hoje = hojeSP(deps.agora());
    const upsert = env.DB.prepare(
      "INSERT INTO pacotes (chave, nome, chegou_em, musicas, visto_em) VALUES (?1, ?2, ?3, ?4, ?3) "
      + "ON CONFLICT (chave) DO UPDATE SET musicas = excluded.musicas, visto_em = excluded.visto_em",
    );
    if (porChave.size) await env.DB.batch([...porChave].map(([chave, p]) => upsert.bind(chave, p.nome, hoje, p.musicas)));
    const { prazoDias } = await leConfig(env, "novidades");
    const classes: Record<string, Pacote> = {};
    for (const p of await listaPacotes(env)) if (porChave.has(p.chave)) classes[p.chave] = classifica(p, prazoDias, hoje);
    return json({ classes });
  });

  rota("POST", "/api/build/status", async ({ req, env, deps }) =>
    json(await registraStatus(env, deps, validaCorpoStatus(await leJson(req)))));
}
