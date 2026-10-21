/**
 * Baixa a planilha do Ari e gera os arquivos que o site usa:
 *   public/data/catalogo.<hash>.json  código, artista, título e pacote
 *   public/data/letras.<hash>.json    coluna "trecho" (separada pra lista aparecer antes)
 *   src/data/gerado/manifesto.json    nomes dos arquivos, primeiras músicas pro HTML estático, serviços
 *   public/versao.txt                 impressão digital dos dados, pro deploy saber se precisa publicar
 *
 * `--offline` (ou SHEET_OFFLINE=1) usa data/fixture/*.csv em vez da planilha (pra rodar sem internet).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { comoObjetos, compacta, lerCsv, montaMusicas, montaServicos } from "../src/lib/planilha.ts";

const PLANILHA = process.env.SHEET_ID ?? "1I6ONYmebHrU7yHE_CdUsCplEuZmTYajZJpJhZmQjjV4";
const OFFLINE = process.argv.includes("--offline") || process.env.SHEET_OFFLINE === "1";
const PRIMEIRAS = 50;

async function aba(nome: string, fixture: string): Promise<Record<string, string>[]> {
  if (OFFLINE) return comoObjetos(lerCsv(await readFile(new URL(`../data/fixture/${fixture}`, import.meta.url), "utf8")));
  const url = `https://docs.google.com/spreadsheets/d/${PLANILHA}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nome)}`;
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return comoObjetos(lerCsv(await r.text()));
    } catch (e) {
      if (tentativa === 3) throw new Error(`Não consegui baixar a aba "${nome}": ${(e as Error).message}`);
      await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
    }
  }
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 10);

const musicas = montaMusicas(await aba("Músicas", "musicas.csv"));
if (musicas.length === 0) throw new Error("A aba Músicas veio vazia. Confere se a planilha está pública.");
const servicos = montaServicos(await aba("Produtos", "produtos.csv"));

const { catalogo, letras } = compacta(musicas);
const jsonCatalogo = JSON.stringify(catalogo);
const jsonLetras = JSON.stringify(letras);
const arqCatalogo = `catalogo.${hash(jsonCatalogo)}.json`;
const arqLetras = `letras.${hash(jsonLetras)}.json`;

await rm(new URL("../public/data/", import.meta.url), { recursive: true, force: true });
await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await mkdir(new URL("../src/data/gerado/", import.meta.url), { recursive: true });
await writeFile(new URL(`../public/data/${arqCatalogo}`, import.meta.url), jsonCatalogo);
await writeFile(new URL(`../public/data/${arqLetras}`, import.meta.url), jsonLetras);
// o deploy de hora em hora compara isso com o que está no ar e só publica se a planilha mudou
await writeFile(new URL("../public/versao.txt", import.meta.url), hash(arqCatalogo + arqLetras + JSON.stringify(servicos)) + "\n");

const manifesto = {
  geradoEm: new Date().toISOString(),
  total: musicas.length,
  temLetras: letras.some(Boolean),
  catalogo: `/data/${arqCatalogo}`,
  letras: `/data/${arqLetras}`,
  // as primeiras já vão no HTML: a página aparece pronta antes do JS e o Google indexa
  primeiras: catalogo.musicas.slice(0, PRIMEIRAS).map(([codigo, a, titulo, pacote], i) => ({
    codigo, artista: catalogo.artistas[a], titulo, pacote, trecho: letras[i],
  })),
  servicos,
};
await writeFile(new URL("../src/data/gerado/manifesto.json", import.meta.url), JSON.stringify(manifesto, null, 1));

const kb = (s: string) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`${musicas.length} músicas${OFFLINE ? " (fixture offline)" : ""} · catálogo ${kb(jsonCatalogo)} kB · letras ${kb(jsonLetras)} kB · ${servicos.length} serviços`);
