/** Leitura e gravação do que o Ari edita: config (JSON por chave), cartões e pacotes. */
import { migraContato } from "../src/lib/painel/contato.ts";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";
import type { Cartao, FonteCatalogo, Modo, PacoteDb, Resultado } from "../src/lib/painel/tipos.ts";
import { idDaPlanilha } from "../src/lib/painel/valida.ts";
import type { Env } from "./tipos.ts";

export type ChaveConfig = keyof typeof CONFIG_PADRAO;

/** Sem linha gravada, vale o site de antes do painel. Contato gravado no formato antigo chega no novo. */
export async function leConfig<K extends ChaveConfig>(env: Env, chave: K): Promise<(typeof CONFIG_PADRAO)[K]> {
  const r = await env.DB.prepare("SELECT valor FROM config WHERE chave = ?").bind(chave).first<{ valor: string }>();
  const valor = r ? JSON.parse(r.valor) : structuredClone(CONFIG_PADRAO[chave]);
  return chave === "contato" ? migraContato(valor) as (typeof CONFIG_PADRAO)[K] : valor;
}

export async function gravaConfig<K extends ChaveConfig>(env: Env, chave: K, valor: (typeof CONFIG_PADRAO)[K], agora: Date): Promise<void> {
  await env.DB.prepare("INSERT INTO config (chave, valor, atualizado_em) VALUES (?1, ?2, ?3) ON CONFLICT (chave) DO UPDATE SET valor = ?2, atualizado_em = ?3")
    .bind(chave, JSON.stringify(valor), agora.toISOString()).run();
}

interface LinhaCartao { id: number; ordem: number; ativo: number; titulo: string; destaque: string; descricao: string; foto_chave: string | null }
const deCartao = (r: LinhaCartao): Cartao => ({
  id: r.id, ordem: r.ordem, ativo: r.ativo === 1, titulo: r.titulo, destaque: r.destaque, descricao: r.descricao, fotoChave: r.foto_chave,
});

export async function listaCartoes(env: Env, opcoes: { soAtivos?: boolean } = {}): Promise<Cartao[]> {
  const { results } = await env.DB.prepare(`SELECT * FROM cartoes ${opcoes.soAtivos ? "WHERE ativo = 1" : ""} ORDER BY ordem, id`).all<LinhaCartao>();
  return results.map(deCartao);
}

interface LinhaPacote { chave: string; nome: string; chegou_em: string; musicas: number; visto_em: string; modo: Modo }

export async function listaPacotes(env: Env): Promise<PacoteDb[]> {
  const { results } = await env.DB.prepare("SELECT * FROM pacotes ORDER BY chegou_em DESC, nome").all<LinhaPacote>();
  return results.map((r) => ({ chave: r.chave, nome: r.nome, chegouEm: r.chegou_em, musicas: r.musicas, vistoEm: r.visto_em, modo: r.modo }));
}

/** Arquivo no R2 com o prefixo certo (fotos/ ou planilhas/). */
export async function existeArquivo(env: Env, chave: unknown, prefixo: "fotos" | "planilhas"): Promise<boolean> {
  if (typeof chave !== "string" || !new RegExp(`^${prefixo}/[\\w.-]+$`).test(chave)) return false;
  return (await env.ARQUIVOS.head(chave)) !== null;
}

/** Valida a troca de fonte do catálogo; o que não muda (link ou arquivo anterior) fica guardado. */
export async function validaCatalogo(env: Env, x: unknown, atual: FonteCatalogo, agora: Date): Promise<Resultado<FonteCatalogo>> {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  if (o.fonte === "link") {
    const id = typeof o.link === "string" ? idDaPlanilha(o.link) : null;
    if (!id) return { ok: false, erro: "Cole o link da planilha do Google (docs.google.com/spreadsheets/...)." };
    return { ok: true, valor: { ...atual, fonte: "link", link: `https://docs.google.com/spreadsheets/d/${id}` } };
  }
  if (o.fonte === "arquivo") {
    const a = (o.arquivo && typeof o.arquivo === "object" ? o.arquivo : {}) as Record<string, unknown>;
    if (!(await existeArquivo(env, a.chave, "planilhas"))) return { ok: false, erro: "Arquivo não encontrado. Envie de novo." };
    const inteiro = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
    const arquivo: NonNullable<FonteCatalogo["arquivo"]> = {
      chave: a.chave as string,
      nome: typeof a.nome === "string" ? a.nome.slice(0, 200) : "planilha.xlsx",
      enviadoEm: agora.toISOString(),
      musicas: inteiro(a.musicas),
      pacotes: inteiro(a.pacotes),
    };
    if (a.forcar === true) arquivo.forcar = true;
    return { ok: true, valor: { ...atual, fonte: "arquivo", arquivo } };
  }
  return { ok: false, erro: "Escolha a fonte do catálogo: arquivo ou link." };
}

type DadosCartao = Omit<Cartao, "id" | "ordem">;

export async function criaCartao(env: Env, d: DadosCartao, agora: Date): Promise<Cartao> {
  const r = await env.DB.prepare(
    "INSERT INTO cartoes (ordem, ativo, titulo, destaque, descricao, foto_chave, atualizado_em) "
    + "VALUES ((SELECT COALESCE(MAX(ordem), 0) + 1 FROM cartoes), ?, ?, ?, ?, ?, ?) RETURNING *",
  ).bind(d.ativo ? 1 : 0, d.titulo, d.destaque, d.descricao, d.fotoChave, agora.toISOString()).first<LinhaCartao>();
  return deCartao(r!);
}

/** false se o cartão não existe. */
export async function atualizaCartao(env: Env, id: number, d: DadosCartao, agora: Date): Promise<boolean> {
  const r = await env.DB.prepare("UPDATE cartoes SET ativo = ?, titulo = ?, destaque = ?, descricao = ?, foto_chave = ?, atualizado_em = ? WHERE id = ?")
    .bind(d.ativo ? 1 : 0, d.titulo, d.destaque, d.descricao, d.fotoChave, agora.toISOString(), id).run();
  return r.meta.changes > 0;
}

export async function apagaCartao(env: Env, id: number): Promise<boolean> {
  return (await env.DB.prepare("DELETE FROM cartoes WHERE id = ?").bind(id).run()).meta.changes > 0;
}

/** Só aceita a lista completa, sem repetir: se mudou em outra aba, o Ari recarrega. */
export async function reordenaCartoes(env: Env, ids: unknown, agora: Date): Promise<boolean> {
  const atuais = (await listaCartoes(env)).map((c) => c.id);
  if (!Array.isArray(ids) || ids.length !== atuais.length || new Set(ids).size !== ids.length || !ids.every((i) => atuais.includes(i))) return false;
  if (ids.length) await env.DB.batch(ids.map((id, i) => env.DB.prepare("UPDATE cartoes SET ordem = ?, atualizado_em = ? WHERE id = ?").bind(i + 1, agora.toISOString(), id)));
  return true;
}

export async function mudaModoPacote(env: Env, chave: string, modo: Modo): Promise<boolean> {
  return (await env.DB.prepare("UPDATE pacotes SET modo = ? WHERE chave = ?").bind(modo, chave).run()).meta.changes > 0;
}
