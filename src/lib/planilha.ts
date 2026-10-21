import { normaliza, tituloBonito, tipoPacote, type Pacote } from "./texto.ts";

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

export function montaMusicas(linhas: Record<string, string>[]): Musica[] {
  const vistos = new Set<string>();
  const grafias = new Map<string, Map<string, number>>();
  const brutas = linhas.filter((l) => {
    const cod = l.codigo;
    if (!cod || !l.titulo || verdadeiro(l.duplicado)) return false;
    if (vistos.has(cod)) return false;
    vistos.add(cod);
    const k = normaliza(l.cantor ?? "");
    const m = grafias.get(k) ?? new Map<string, number>();
    m.set(l.cantor, (m.get(l.cantor) ?? 0) + 1);
    grafias.set(k, m);
    return true;
  });
  // "5 Seconds Of Summer" e "5 Seconds of Summer" viram um artista só, com a grafia mais usada
  const nomeDe = new Map<string, string>();
  for (const [k, m] of grafias) nomeDe.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0]);
  return brutas.map((l) => ({
    codigo: l.codigo,
    artista: nomeDe.get(normaliza(l.cantor ?? "")) ?? l.cantor,
    titulo: tituloBonito(l.titulo),
    pacote: tipoPacote(l.pacote ?? ""),
    trecho: (l.trecho ?? "").replace(/\s+/g, " ").trim(),
  }));
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
