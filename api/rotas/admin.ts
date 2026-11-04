import { classifica, hojeSP } from "../../src/lib/painel/classifica.ts";
import type { Resultado } from "../../src/lib/painel/tipos.ts";
import { validaBanner, validaCartao, validaContato, validaNovidades } from "../../src/lib/painel/valida.ts";
import {
  apagaCartao, atualizaCartao, criaCartao, existeArquivo, gravaConfig, leConfig, listaCartoes, listaPacotes, mudaModoPacote, reordenaCartoes, validaCatalogo, type ChaveConfig,
} from "../config.ts";
import { criaPublicacao, musicasNoAr, ultimasPublicacoes } from "../publicacoes.ts";
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
  rota("GET", "/api/admin/estado", async ({ env, deps, admin }) => {
    const [contato, banner, catalogo, novidades, cartoes, pacotes, historico, noAr] = await Promise.all([
      leConfig(env, "contato"), leConfig(env, "banner"), leConfig(env, "catalogo"), leConfig(env, "novidades"),
      listaCartoes(env), listaPacotes(env), ultimasPublicacoes(env, 3), musicasNoAr(env),
    ]);
    const hoje = hojeSP(deps.agora());
    return json({
      contato, banner, catalogo, novidades, cartoes,
      pacotes: pacotes.map((p) => ({ ...p, classe: classifica(p, novidades.prazoDias, hoje) })),
      publicacao: historico[0] ?? null, historico, musicasNoAr: noAr, hoje,
      email: admin?.email ?? null,
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

  /* ---------- cartões de "Pra sua festa" ---------- */
  const publica = async (c: Contexto, extra: Record<string, unknown> = {}) =>
    json({ ok: true, ...extra, publicacao: await criaPublicacao(c.env, c.deps, "cartoes") });
  const dadosCartao = async (c: Contexto) => {
    const d = valorOu400(validaCartao(await leJson(c.req)));
    if (d.fotoChave && !(await existeArquivo(c.env, d.fotoChave, "fotos"))) throw new ErroHttp("Foto não encontrada. Envie de novo.", 400);
    return d;
  };
  const idDe = (c: Contexto) => {
    const id = Number(c.params.id);
    if (!Number.isInteger(id)) throw new ErroHttp("Cartão não encontrado", 404);
    return id;
  };

  rota("POST", "/api/admin/cartoes", async (c) => publica(c, { cartao: await criaCartao(c.env, await dadosCartao(c), c.deps.agora()) }));
  // antes de /:id, senão "ordem" vira um id
  rota("PUT", "/api/admin/cartoes/ordem", async (c) => {
    const { ids } = ((await leJson(c.req)) ?? {}) as { ids?: unknown };
    if (!(await reordenaCartoes(c.env, ids, c.deps.agora()))) throw new ErroHttp("A lista de cartões mudou. Recarregue a página.", 400);
    return publica(c);
  });
  rota("PUT", "/api/admin/cartoes/:id", async (c) => {
    const id = idDe(c);
    if (!(await atualizaCartao(c.env, id, await dadosCartao(c), c.deps.agora()))) throw new ErroHttp("Cartão não encontrado", 404);
    return publica(c);
  });
  rota("DELETE", "/api/admin/cartoes/:id", async (c) => {
    if (!(await apagaCartao(c.env, idDe(c)))) throw new ErroHttp("Cartão não encontrado", 404);
    return publica(c);
  });

  /* ---------- pacotes: classificação manual ---------- */
  rota("PUT", "/api/admin/pacotes/:chave", async (c) => {
    const { modo } = ((await leJson(c.req)) ?? {}) as { modo?: unknown };
    if (modo !== "auto" && modo !== "nova" && modo !== "exc" && modo !== "base") throw new ErroHttp("Escolha Automático, Novidade, Só no Ari ou Normal.", 400);
    if (!(await mudaModoPacote(c.env, c.params.chave, modo))) throw new ErroHttp("Pacote não encontrado", 404);
    return json({ ok: true, publicacao: await criaPublicacao(c.env, c.deps, "pacotes") });
  });

  // "Tentar de novo" e "Atualizar catálogo"
  rota("POST", "/api/admin/publicar", async ({ req, env, deps }) => {
    const { motivo } = ((await leJson(req)) ?? {}) as { motivo?: string };
    const publicacao = await criaPublicacao(env, deps, motivo && MOTIVOS_MANUAIS.has(motivo) ? motivo : "manual");
    return json({ ok: true, publicacao });
  });
}
