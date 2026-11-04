import { chavePacote } from "./painel/classifica.ts";
import { chaveArtista, nomeArtista, normaliza, tituloBonito, tipoPacote, type Pacote } from "./texto.ts";

/** CSV no formato que o Google Sheets exporta (aspas duplas, quebras de linha dentro de campos). */
export function lerCsv(txt: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) {
      if (c === '"') {
        if (txt[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/** Tabela -> objetos, com cabeçalho normalizado ("Código" e "codigo" viram "codigo"). */
export function comoObjetos(linhas: string[][]): Record<string, string>[] {
  const [cab = [], ...resto] = linhas;
  const chaves = cab.map((h) => normaliza(h));
  return resto.map((l) => Object.fromEntries(chaves.map((k, i) => [k, (l[i] ?? "").trim()])));
}

export interface Musica {
  codigo: string;
  artista: string;
  titulo: string;
  pacote: Pacote;
  trecho: string;
}

/**
 * Formato enviado pro navegador. Colunar e com artistas deduplicados pra pesar pouco:
 * cada música é [codigo, índice do artista, título, pacote].
 */
export interface Catalogo {
  artistas: string[];
  musicas: [string, number, string, Pacote][];
}

const verdadeiro = (s: string | undefined) => /^(true|verdadeiro|sim|s|1)$/i.test((s ?? "").trim());

/** "0" ou um trecho igual ao pacote ("COM VOCAIS") é marcador da planilha, não letra. */
function limpaTrecho(trecho = "", pacote = ""): string {
  const t = trecho.replace(/\s+/g, " ").trim().replace(/[´`]/g, "’");
  if (!/\p{L}/u.test(t) || t.toUpperCase() === pacote.trim().toUpperCase()) return "";
  return t;
}

/** Linhas que entram no catálogo: com código e título, sem "duplicado" e sem repetir código (vale a primeira). */
function linhasValidas(linhas: Record<string, string>[]): Record<string, string>[] {
  const vistos = new Set<string>();
  return linhas.filter((l) => {
    const cod = l.codigo;
    if (!cod || !l.titulo || verdadeiro(l.duplicado) || vistos.has(cod)) return false;
    vistos.add(cod);
    return true;
  });
}

/** Grafia mais usada de cada grupo ("13K" ganha de "13k "). */
function maisUsada(contagem: Map<string, number>): string {
  return [...contagem].sort((a, b) => b[1] - a[1])[0][0];
}

/** `tipo` decide nova/exc/base de cada pacote; sem painel, vale a regra antiga pelo nome. */
export function montaMusicas(linhas: Record<string, string>[], tipo: (pacote: string) => Pacote = tipoPacote): Musica[] {
  const grafias = new Map<string, Map<string, number>>();
  const brutas = linhasValidas(linhas);
  for (const l of brutas) {
    const k = chaveArtista(l.cantor ?? "");
    const m = grafias.get(k) ?? new Map<string, number>();
    m.set(l.cantor, (m.get(l.cantor) ?? 0) + 1);
    grafias.set(k, m);
  }
  // "5 Seconds Of Summer", "5 Seconds of Summer" e "Guns n´ Roses", "Guns N Roses" viram um artista só, com a grafia mais usada
  const nomeDe = new Map<string, string>();
  for (const [k, m] of grafias) nomeDe.set(k, nomeArtista(maisUsada(m)));
  return brutas.map((l) => ({
    codigo: l.codigo,
    artista: nomeDe.get(chaveArtista(l.cantor ?? "")) ?? l.cantor,
    titulo: tituloBonito(l.titulo),
    pacote: tipo(l.pacote ?? ""),
    trecho: limpaTrecho(l.trecho, l.pacote),
  }));
}

/** Quantas músicas cada pacote tem no catálogo, juntando grafias ("13K" e "13k "). Pacote vazio vem com nome "". */
export function contaPacotes(linhas: Record<string, string>[]): { nome: string; musicas: number }[] {
  const grupos = new Map<string, { grafias: Map<string, number>; musicas: number }>();
  for (const l of linhasValidas(linhas)) {
    const nome = (l.pacote ?? "").trim();
    const k = chavePacote(nome);
    const g = grupos.get(k) ?? { grafias: new Map<string, number>(), musicas: 0 };
    g.grafias.set(nome, (g.grafias.get(nome) ?? 0) + 1);
    g.musicas++;
    grupos.set(k, g);
  }
  return [...grupos.values()].map((g) => ({ nome: maisUsada(g.grafias), musicas: g.musicas }));
}

export function porArtista(a: Musica, b: Musica): number {
  return a.artista.localeCompare(b.artista, "pt") || a.titulo.localeCompare(b.titulo, "pt");
}

/** Separa o catálogo das letras, que pesam mais: a lista aparece antes e as letras chegam em seguida. */
export function compacta(musicas: Musica[]): { catalogo: Catalogo; letras: string[] } {
  const ordenadas = [...musicas].sort(porArtista);
  const artistas: string[] = [];
  const idx = new Map<string, number>();
  const linhas: Catalogo["musicas"] = ordenadas.map((m) => {
    let i = idx.get(m.artista);
    if (i === undefined) { i = artistas.push(m.artista) - 1; idx.set(m.artista, i); }
    return [m.codigo, i, m.titulo, m.pacote];
  });
  return { catalogo: { artistas, musicas: linhas }, letras: ordenadas.map((m) => m.trecho) };
}

export interface Servico { titulo: string; destaque: string; descricao: string }

export function montaServicos(linhas: Record<string, string>[]): Servico[] {
  return linhas
    .filter((l) => (l.ativo ?? "S").toUpperCase().startsWith("S") && l.titulo && l.descricao)
    .map((l) => ({ titulo: l.titulo, destaque: l.destaque ?? "", descricao: l.descricao }));
}
