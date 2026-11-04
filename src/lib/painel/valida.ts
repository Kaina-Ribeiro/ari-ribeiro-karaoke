import type { Banner, Cartao, Contato, Novidades, Resultado } from "./tipos.ts";

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const falha = <T = never>(erro: string): Resultado<T> => ({ ok: false, erro });

/** Letras como a pessoa vê: "ç" decomposto (macOS) conta como uma. */
export const tamanho = (s: string): number => [...s.normalize("NFC")].length;
const texto = (x: unknown): string => (typeof x === "string" ? x.normalize("NFC").trim() : "");
const objeto = (x: unknown): Record<string, unknown> => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});

const ERRO_ZAP = "Use um celular com DDD: (12) 99999-9999";

/** Aceita o número colado de qualquer jeito e guarda como 55DDNNNNNNNNN. Só celular. */
export function normalizaZap(s: string): Resultado<string> {
  let d = s.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("0")) d = d.slice(1);
  if (!/^[1-9]{2}9\d{8}$/.test(d)) return falha(ERRO_ZAP);
  return ok("55" + d);
}

export function formataZap(z: string): string {
  const d = z.replace(/^55/, "");
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** "@ari", "instagram.com/ari/" e "ari" viram "ari". */
export function normalizaUsuario(s: string): Resultado<string> {
  const u = s.trim()
    .replace(/^(https?:\/\/)?(www\.|m\.)?(instagram|facebook)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  if (!/^[A-Za-z0-9._]{1,50}$/.test(u)) return falha("Use só o nome de usuário, sem espaços (ex.: ariribeirokaraoke)");
  return ok(u);
}

export function validaContato(x: unknown): Resultado<Contato> {
  const o = objeto(x);
  const contato = normalizaZap(texto(o.zapContato));
  if (!contato.ok) return falha("Zap de contato: " + contato.erro);
  let zapKj: string | null = null;
  if (texto(o.zapKj)) {
    const kj = normalizaZap(texto(o.zapKj));
    if (!kj.ok) return falha("Zap do KJ: " + kj.erro);
    zapKj = kj.valor;
  }
  const insta = normalizaUsuario(texto(o.instagram));
  if (!insta.ok) return falha("Instagram: " + insta.erro);
  let facebook: string | null = null;
  if (texto(o.facebook)) {
    const fb = normalizaUsuario(texto(o.facebook));
    if (!fb.ok) return falha("Facebook: " + fb.erro);
    facebook = fb.valor;
  }
  return ok({ zapContato: contato.valor, zapKj, instagram: insta.valor, facebook });
}

export const LIMITES = { linha: 14, frase: 80, legenda: [16, 30], titulo: 40, destaque: 30, descricao: 160 } as const;

export function validaBanner(x: unknown): Resultado<Banner> {
  const o = objeto(x);
  const ls = Array.isArray(o.linhas) ? o.linhas : [];
  const linhas = [0, 1, 2].map((i) => texto(ls[i])) as Banner["linhas"];
  if (!linhas[0]) return falha("A linha 1 da frase grande é obrigatória");
  for (let i = 0; i < 3; i++) {
    if (tamanho(linhas[i]) > LIMITES.linha) return falha(`A linha ${i + 1} pode ter até ${LIMITES.linha} letras`);
  }
  const frase = texto(o.frase);
  if (!frase) return falha("A frase de baixo é obrigatória");
  if (tamanho(frase) > LIMITES.frase) return falha(`A frase de baixo pode ter até ${LIMITES.frase} letras`);
  const lg = Array.isArray(o.legenda) ? o.legenda : [];
  const legenda = [texto(lg[0]), texto(lg[1])] as Banner["legenda"];
  for (let i = 0; i < 2; i++) {
    if (tamanho(legenda[i]) > LIMITES.legenda[i]) return falha(`A legenda ${i + 1} pode ter até ${LIMITES.legenda[i]} letras`);
  }
  const f = objeto(o.foto);
  if (typeof f.chave !== "string" || !f.chave) return falha("Escolha uma foto para o banner");
  return ok({ linhas, frase, legenda, foto: { chave: f.chave, recortada: f.recortada === true } });
}

export function validaCartao(x: unknown): Resultado<Omit<Cartao, "id" | "ordem">> {
  const o = objeto(x);
  const titulo = texto(o.titulo), destaque = texto(o.destaque), descricao = texto(o.descricao);
  if (!titulo) return falha("O título do cartão é obrigatório");
  if (tamanho(titulo) > LIMITES.titulo) return falha(`O título pode ter até ${LIMITES.titulo} letras`);
  if (tamanho(destaque) > LIMITES.destaque) return falha(`O destaque pode ter até ${LIMITES.destaque} letras`);
  if (!descricao) return falha("A descrição do cartão é obrigatória");
  if (tamanho(descricao) > LIMITES.descricao) return falha(`A descrição pode ter até ${LIMITES.descricao} letras`);
  const fotoChave = typeof o.fotoChave === "string" && o.fotoChave ? o.fotoChave : null;
  return ok({ ativo: o.ativo !== false, titulo, destaque, descricao, fotoChave });
}

export function validaNovidades(x: unknown): Resultado<Novidades> {
  const p = objeto(x).prazoDias;
  if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 365) return falha("O prazo precisa ser de 1 a 365 dias");
  return ok({ prazoDias: p });
}

/** Id da planilha só se o link for mesmo do Google Sheets. */
export function idDaPlanilha(url: string): string | null {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.hostname !== "docs.google.com") return null;
  const m = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})(\/|$)/.exec(u.pathname);
  return m ? m[1] : null;
}
