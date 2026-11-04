import { classifica, hojeSP } from "../../src/lib/painel/classifica.ts";
import type { Resultado } from "../../src/lib/painel/tipos.ts";
import { validaBanner, validaContato, validaNovidades } from "../../src/lib/painel/valida.ts";
import { existeArquivo, gravaConfig, leConfig, listaCartoes, listaPacotes, validaCatalogo, type ChaveConfig } from "../config.ts";
import { criaPublicacao, musicasNoAr, ultimaPublicacao } from "../publicacoes.ts";
import { ErroHttp, json, leJson } from "../resposta.ts";
import type { Contexto, criaRoteador } from "../roteador.ts";

type Rota = ReturnType<typeof criaRoteador>["rota"];

const MOTIVOS_MANUAIS = new Set(["tentar-de-novo", "atualizar-catalogo"]);

/** Erro de validação vira 400 com a mensagem pro Ari. */
export function valorOu400<T>(r: Resultado<T>): T {
  if (!r.ok) throw new ErroHttp(r.erro, 400);
  return r.valor;
}

/** Grava e publica: toda mudança vai pro ar. */
async function salvaEPublica<K extends ChaveConfig>(c: Contexto, chave: K, valor: Parameters<typeof gravaConfig<K>>[2]) {
  await gravaConfig(c.env, chave, valor, c.deps.agora());
  return json({ ok: true, publicacao: await criaPublicacao(c.env, c.deps, chave) });
}

export function registraAdmin(rota: Rota) {
  rota("GET", "/api/admin/estado", async ({ env, deps }) => {
    const [contato, banner, catalogo, novidades, cartoes, pacotes, publicacao, noAr] = await Promise.all([
      leConfig(env, "contato"), leConfig(env, "banner"), leConfig(env, "catalogo"), leConfig(env, "novidades"),
      listaCartoes(env), listaPacotes(env), ultimaPublicacao(env), musicasNoAr(env),
    ]);
    const hoje = hojeSP(deps.agora());
    return json({
      contato, banner, catalogo, novidades, cartoes,
      pacotes: pacotes.map((p) => ({ ...p, classe: classifica(p, novidades.prazoDias, hoje) })),
      publicacao, musicasNoAr: noAr, hoje,
    });
  });

  rota("PUT", "/api/admin/contato", async (c) => salvaEPublica(c, "contato", valorOu400(validaContato(await leJson(c.req)))));

  rota("PUT", "/api/admin/banner", async (c) => {
    const banner = valorOu400(validaBanner(await leJson(c.req)));
    if (!(await existeArquivo(c.env, banner.foto.chave, "fotos"))) throw new ErroHttp("Foto não encontrada. Envie de novo.", 400);
    return salvaEPublica(c, "banner", banner);
  });

  rota("PUT", "/api/admin/catalogo", async (c) => {
    const atual = await leConfig(c.env, "catalogo");
    return salvaEPublica(c, "catalogo", valorOu400(await validaCatalogo(c.env, await leJson(c.req), atual, c.deps.agora())));
  });

  rota("PUT", "/api/admin/novidades", async (c) => salvaEPublica(c, "novidades", valorOu400(validaNovidades(await leJson(c.req)))));

  // "Tentar de novo" e "Atualizar catálogo"
  rota("POST", "/api/admin/publicar", async ({ req, env, deps }) => {
    const { motivo } = ((await leJson(req)) ?? {}) as { motivo?: string };
    const publicacao = await criaPublicacao(env, deps, motivo && MOTIVOS_MANUAIS.has(motivo) ? motivo : "manual");
    return json({ ok: true, publicacao });
  });
}
