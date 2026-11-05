/** Partes puras da importação inicial: o que vai pro D1 e o SQL que grava, sem pisar no que o Ari já mudou. */
import { chavePacote } from "../src/lib/painel/classifica.ts";
import { migraContato } from "../src/lib/painel/contato.ts";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";
import type { Banner, Cartao, Contato, FonteCatalogo, Novidades } from "../src/lib/painel/tipos.ts";
import { normalizaZap } from "../src/lib/painel/valida.ts";
import { contaPacotes, montaServicos } from "../src/lib/planilha.ts";
import { normaliza } from "../src/lib/texto.ts";

export interface DadosImportacao {
  contato: Contato;
  banner: Banner;
  catalogo: FonteCatalogo;
  novidades: Novidades;
  cartoes: Omit<Cartao, "id">[];
  pacotes: { nome: string; musicas: number }[];
  hoje: string;
}

const CONTATO_LOCACAO = "contato para locacao";

/** Aba Produtos vira contato + cartões; aba Músicas vira a lista de pacotes. Banner e catálogo: o site de hoje. */
export function dadosImportacao(produtos: Record<string, string>[], musicas: Record<string, string>[], hoje: string): DadosImportacao {
  const linhaContato = produtos.find((p) => normaliza(p.titulo ?? "") === CONTATO_LOCACAO);
  const zap = normalizaZap(linhaContato?.destaque ?? "");
  const cartoes = montaServicos(produtos)
    .filter((s) => normaliza(s.titulo) !== CONTATO_LOCACAO)
    .map((s, i) => ({ ordem: i + 1, ativo: true, titulo: s.titulo, destaque: s.destaque, descricao: s.descricao, fotoChave: null }));
  return {
    // o Zap da planilha vira o geral (com o nome de quem atende, se for um número conhecido); redes como no padrão
    contato: zap.ok ? { ...migraContato({ zapContato: zap.valor }), redes: CONFIG_PADRAO.contato.redes } : CONFIG_PADRAO.contato,
    banner: CONFIG_PADRAO.banner,
    catalogo: CONFIG_PADRAO.catalogo,
    novidades: CONFIG_PADRAO.novidades,
    cartoes,
    pacotes: contaPacotes(musicas).filter((p) => p.nome),
    hoje,
  };
}

const txt = (s: string | null) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`);

/**
 * Uma instrução por item. Idempotente: config e pacotes com INSERT OR IGNORE (não pisa no que o Ari mudou);
 * cartões só se a tabela estiver vazia.
 */
export function sqlImportacao(d: DadosImportacao): string[] {
  const agora = txt(d.hoje + "T00:00:00.000Z");
  const sql: string[] = [];
  for (const chave of ["contato", "banner", "catalogo", "novidades"] as const) {
    sql.push(`INSERT OR IGNORE INTO config (chave, valor, atualizado_em) VALUES (${txt(chave)}, ${txt(JSON.stringify(d[chave]))}, ${agora})`);
  }
  if (d.cartoes.length) {
    const valores = d.cartoes.map((c) => `(${c.ordem}, ${c.ativo ? 1 : 0}, ${txt(c.titulo)}, ${txt(c.destaque)}, ${txt(c.descricao)}, ${txt(c.fotoChave)}, ${agora})`);
    sql.push(
      "INSERT INTO cartoes (ordem, ativo, titulo, destaque, descricao, foto_chave, atualizado_em) "
      + `SELECT * FROM (VALUES ${valores.join(", ")}) WHERE NOT EXISTS (SELECT 1 FROM cartoes)`,
    );
  }
  for (const p of d.pacotes) {
    sql.push(`INSERT OR IGNORE INTO pacotes (chave, nome, chegou_em, musicas, visto_em, modo) VALUES (${txt(chavePacote(p.nome))}, ${txt(p.nome)}, ${txt(d.hoje)}, ${p.musicas}, ${txt(d.hoje)}, 'auto')`);
  }
  return sql;
}
