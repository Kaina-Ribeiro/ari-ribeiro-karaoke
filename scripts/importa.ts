/**
 * Importação inicial: grava no D1 o site de hoje (contato, banner, cartões da aba Produtos, pacotes da aba Músicas)
 * e sobe a foto do Ari pro R2. Roda uma vez por ambiente; rodar de novo não duplica nem apaga o que o Ari mudou.
 *
 *   node scripts/importa.ts --alvo local [--offline]   banco local do `pnpm painel` (.wrangler/painel)
 *   node scripts/importa.ts --alvo preview             D1/R2 de preview na Cloudflare (pergunta antes)
 *   node scripts/importa.ts --alvo producao            D1/R2 de produção (pergunta antes)
 *
 * A planilha do Google é só lida.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";
import { hojeSP } from "../src/lib/painel/classifica.ts";
import { idDaPlanilha } from "../src/lib/painel/valida.ts";
import { comoObjetos, lerCsv } from "../src/lib/planilha.ts";
import { baixaCsv } from "./google.ts";
import { dadosImportacao, sqlImportacao } from "./importa-sql.ts";
import { wrangler } from "./wrangler.ts";

const ALVOS = {
  local: { flags: ["--local", "--persist-to", ".wrangler/painel"], bucket: "ari-arquivos" },
  preview: { flags: ["--env", "preview", "--remote"], bucket: "ari-arquivos-preview" },
  producao: { flags: ["--remote"], bucket: "ari-arquivos" },
} as const;

const arg = (nome: string) => process.argv[process.argv.indexOf(nome) + 1];
const alvo = arg("--alvo") as keyof typeof ALVOS;
const OFFLINE = process.argv.includes("--offline");
if (!(alvo in ALVOS)) {
  console.error("Use: node scripts/importa.ts --alvo local|preview|producao [--offline]");
  process.exit(1);
}

if (alvo !== "local") {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question(`Confirma importar em ${alvo}? (s/N) `);
  rl.close();
  if (!/^s/i.test(r.trim())) process.exit(0);
}

const fixture = (n: string) => readFile(new URL(`../data/fixture/${n}`, import.meta.url), "utf8");
const id = idDaPlanilha(CONFIG_PADRAO.catalogo.link!)!;
const [produtos, musicas] = await Promise.all(
  OFFLINE ? [fixture("produtos.csv"), fixture("musicas.csv")] : [baixaCsv(id, "Produtos"), baixaCsv(id, "Músicas")],
);
const dados = dadosImportacao(comoObjetos(lerCsv(produtos)), comoObjetos(lerCsv(musicas)), hojeSP(new Date()));

const { flags, bucket } = ALVOS[alvo];
const pasta = await mkdtemp(join(tmpdir(), "ari-importa-"));
const arquivoSql = join(pasta, "importa.sql");
await writeFile(arquivoSql, sqlImportacao(dados).join(";\n") + ";\n");
try {
  wrangler(["d1", "migrations", "apply", "DB", ...flags]);
  wrangler(["d1", "execute", "DB", "--file", arquivoSql, ...flags, "--yes"]);
  // a foto de hoje, recortada (fundo transparente), vira a foto do banner
  wrangler(["r2", "object", "put", `${bucket}/${CONFIG_PADRAO.banner.foto.chave}`, "--file", "public/img/ari-cantando.webp", "--content-type", "image/webp", ...flags]);
} finally {
  await rm(pasta, { recursive: true, force: true });
}
console.log(`✅ Importado em ${alvo}: ${dados.cartoes.length} cartões, ${dados.pacotes.length} pacotes, Zap ${dados.contato.zapContato}.`);
