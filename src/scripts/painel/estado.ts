/** Estado do painel (GET /api/admin/estado), com consulta a cada 10 s enquanto houver publicação aberta. */
import type { Publicacao } from "../../../api/publicacoes.ts";
import type { Banner, Cartao, Contato, FonteCatalogo, Novidades, PacoteDb } from "../../lib/painel/tipos.ts";
import type { Pacote } from "../../lib/texto.ts";
import { api, ErroApi } from "./api.ts";

export interface Estado {
  contato: Contato;
  banner: Banner;
  catalogo: FonteCatalogo;
  novidades: Novidades;
  cartoes: Cartao[];
  pacotes: (PacoteDb & { classe: Pacote })[];
  publicacao: Publicacao | null;
  musicasNoAr: number | null;
  hoje: string;
  /** e-mail de quem entrou no painel */
  email: string | null;
}

export type Situacao = { estado: Estado | null; erro: string | null };

const INTERVALO = 10_000;
let situacao: Situacao = { estado: null, erro: null };
const ouvintes = new Set<(s: Situacao) => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export const atual = () => situacao;

export function assina(fn: (s: Situacao) => void): () => void {
  ouvintes.add(fn);
  fn(situacao);
  return () => ouvintes.delete(fn);
}

const aberta = (p: Publicacao | null) => p?.status === "pendente" || p?.status === "rodando";

export async function carrega(): Promise<Estado | null> {
  clearTimeout(timer);
  try {
    situacao = { estado: await api<Estado>("GET", "/api/admin/estado"), erro: null };
  } catch (e) {
    situacao = { estado: situacao.estado, erro: e instanceof ErroApi ? e.message : String(e) };
  }
  ouvintes.forEach((fn) => fn(situacao));
  if (situacao.erro || aberta(situacao.estado?.publicacao ?? null)) timer = setTimeout(carrega, INTERVALO);
  return situacao.estado;
}
