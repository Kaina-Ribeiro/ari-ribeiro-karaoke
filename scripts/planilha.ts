/**
 * Gera os dados do site a partir do painel do Ari:
 *   public/data/catalogo.<hash>.json  código, artista, título e pacote
 *   public/data/letras.<hash>.json    coluna "trecho" (separada pra lista aparecer antes)
 *   public/img/painel/<hash>.webp     fotos do banner e dos cartões (o site não depende do R2)
 *   src/data/gerado/manifesto.json    nomes dos arquivos, primeiras músicas, contato, banner, cartões
 *   public/versao.txt                 impressão digital dos dados, pro deploy saber se precisa publicar
 *
 * Online: config de PAINEL_URL (com BUILD_TOKEN); catálogo do .xlsx enviado (R2) ou do link do Google.
 * `--offline` (ou SHEET_OFFLINE=1): data/fixture/config.json, data/fixture/*.csv e data/fixture/r2/. Sem rede.
 * Qualquer erro vai também pra .erro-build.txt (o workflow mostra no painel).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { confereTamanho, extensaoFoto, montaManifesto, type BaseManifesto } from "../src/lib/build.ts";
import { chavePacote, classifica, hojeSP } from "../src/lib/painel/classifica.ts";
import type { ConfigBuild } from "../src/lib/painel/tipos.ts";
import { idDaPlanilha } from "../src/lib/painel/valida.ts";
import { comoObjetos, compacta, contaPacotes, lerCsv, montaMusicas } from "../src/lib/planilha.ts";
import type { Pacote } from "../src/lib/texto.ts";
import { lerAbaMusicas } from "../src/lib/xlsx.ts";
import { baixaCsv } from "./google.ts";
import { clientePainel } from "./painel.ts";

const OFFLINE = process.argv.includes("--offline") || process.env.SHEET_OFFLINE === "1";
const PRIMEIRAS = 50;
const ERRO = new URL("../.erro-build.txt", import.meta.url);
const arquivo = (caminho: string) => new URL("../" + caminho, import.meta.url);
const hash = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex").slice(0, 10);

/** De onde vêm config, arquivos do R2 e os pacotes classificados: o painel, ou a fixture no modo offline. */
function fonteDeDados() {
  if (OFFLINE) {
    return {
      config: async (): Promise<ConfigBuild> => {
        const c = JSON.parse(await readFile(arquivo("data/fixture/config.json"), "utf8"));
        return { ...c, hoje: c.hoje ?? hojeSP(new Date()) };
      },
      arquivo: async (chave: string) => new Uint8Array(await readFile(arquivo("data/fixture/r2/" + chave))),
      // sem painel: pacote que a fixture não conhece conta como chegado hoje
      classes: async (config: ConfigBuild, pacotes: { nome: string }[]) => Object.fromEntries(pacotes.map((p) => {
        const k = chavePacote(p.nome);
        const db = config.pacotes.find((x) => x.chave === k) ?? { nome: p.nome, chegouEm: config.hoje, modo: "auto" as const };
        return [k, classifica(db, config.novidades.prazoDias, config.hoje)];
      })),
      csv: async () => readFile(arquivo("data/fixture/musicas.csv"), "utf8"),
    };
  }
  const url = process.env.PAINEL_URL, token = process.env.BUILD_TOKEN;
  if (!url || !token) throw new Error("Falta PAINEL_URL/BUILD_TOKEN. Para testar sem rede use --offline.");
  const painel = clientePainel(url, token);
  return {
    config: painel.config,
    arquivo: async (chave: string) => new Uint8Array(await painel.arquivo(chave)),
    classes: async (_c: ConfigBuild, pacotes: { nome: string; musicas: number }[]) => painel.pacotes(pacotes),
    csv: async (id: string) => baixaCsv(id, "Músicas"),
  };
}

async function principal() {
  await rm(ERRO, { force: true });
  const dados = fonteDeDados();
  const config = await dados.config();

  let linhas: Record<string, string>[];
  if (config.catalogo.fonte === "arquivo" && config.catalogo.arquivo) {
    linhas = lerAbaMusicas(await dados.arquivo(config.catalogo.arquivo.chave));
  } else {
    const id = idDaPlanilha(config.catalogo.link ?? "");
    if (!id) throw new Error("O link da planilha no painel não é do Google Sheets.");
    linhas = comoObjetos(lerCsv(await dados.csv(id)));
  }

  const pacotes = contaPacotes(linhas).filter((p) => p.nome);
  const classes: Record<string, Pacote> = await dados.classes(config, pacotes);
  const musicas = montaMusicas(linhas, (p) => classes[chavePacote(p)] ?? "base");
  if (musicas.length === 0) throw new Error("A aba Músicas veio vazia. Confere se a planilha está pública.");
  const forcar = config.catalogo.fonte === "arquivo" && config.catalogo.arquivo?.forcar === true;
  const trava = confereTamanho(musicas.length, config.musicasNoAr, forcar);
  if (trava) throw new Error(trava);

  // fotos do R2 viram arquivos do site, com o hash no nome (cache longo, troca de nome quando muda)
  await rm(arquivo("public/img/painel/"), { recursive: true, force: true });
  await mkdir(arquivo("public/img/painel/"), { recursive: true });
  const fotos = new Map<string, string>();
  for (const chave of new Set([config.banner.foto.chave, ...config.cartoes.map((c) => c.fotoChave).filter((c): c is string => !!c)])) {
    const bytes = await dados.arquivo(chave);
    const nome = `${hash(bytes)}.${extensaoFoto(chave)}`;
    await writeFile(arquivo("public/img/painel/" + nome), bytes);
    fotos.set(chave, "/img/painel/" + nome);
  }

  const { catalogo, letras } = compacta(musicas);
  const jsonCatalogo = JSON.stringify(catalogo);
  const jsonLetras = JSON.stringify(letras);
  const arqCatalogo = `catalogo.${hash(jsonCatalogo)}.json`;
  const arqLetras = `letras.${hash(jsonLetras)}.json`;

  const base: BaseManifesto = {
    geradoEm: new Date().toISOString(),
    total: musicas.length,
    temLetras: letras.some(Boolean),
    catalogo: `/data/${arqCatalogo}`,
    letras: `/data/${arqLetras}`,
    // as primeiras já vão no HTML: a página aparece pronta antes do JS e o Google indexa
    primeiras: catalogo.musicas.slice(0, PRIMEIRAS).map(([codigo, a, titulo, pacote], i) => ({
      codigo, artista: catalogo.artistas[a], titulo, pacote, trecho: letras[i],
    })),
  };
  const manifesto = montaManifesto(base, config, fotos);

  await rm(arquivo("public/data/"), { recursive: true, force: true });
  await mkdir(arquivo("public/data/"), { recursive: true });
  await mkdir(arquivo("src/data/gerado/"), { recursive: true });
  await writeFile(arquivo(`public/data/${arqCatalogo}`), jsonCatalogo);
  await writeFile(arquivo(`public/data/${arqLetras}`), jsonLetras);
  // a checagem diária compara isso com o que está no ar e só publica se algo mudou (dados ou config)
  const { geradoEm: _g, primeiras: _p, ...semData } = manifesto;
  await writeFile(arquivo("public/versao.txt"), hash(arqCatalogo + arqLetras + JSON.stringify(semData)) + "\n");
  await writeFile(arquivo("src/data/gerado/manifesto.json"), JSON.stringify(manifesto, null, 1));

  const kb = (s: string) => (Buffer.byteLength(s) / 1024).toFixed(0);
  console.log(`${musicas.length} músicas${OFFLINE ? " (fixture offline)" : ""} · catálogo ${kb(jsonCatalogo)} kB · letras ${kb(jsonLetras)} kB · ${manifesto.servicos.length} serviços · ${fotos.size} fotos`);
}

try {
  await principal();
} catch (e) {
  const msg = (e as Error).message;
  await writeFile(ERRO, msg + "\n").catch(() => {});
  console.error("❌ " + msg);
  process.exit(1);
}
