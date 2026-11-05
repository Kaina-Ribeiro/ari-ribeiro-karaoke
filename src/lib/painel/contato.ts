/**
 * Contato do site: vários WhatsApp com nome e as redes sociais. Usado pelo painel, pela API e pelo build.
 * Também lê o formato antigo (um Zap de contato + Zap do KJ + Instagram/Facebook) que ainda pode estar no D1.
 */
import type { Contato, PerfilRede, Rede, ZapNomeado } from "./tipos.ts";

export const REDES: { rede: Rede; rotulo: string; prefixo: string; url: (u: string) => string; texto: (u: string) => string }[] = [
  { rede: "instagram", rotulo: "Instagram", prefixo: "@", url: (u) => `https://www.instagram.com/${u}/`, texto: (u) => "@" + u },
  { rede: "facebook", rotulo: "Facebook", prefixo: "facebook.com/", url: (u) => `https://www.facebook.com/${u}`, texto: (u) => "facebook.com/" + u },
  { rede: "x", rotulo: "X (Twitter)", prefixo: "@", url: (u) => `https://x.com/${u}`, texto: (u) => "@" + u },
  { rede: "tiktok", rotulo: "TikTok", prefixo: "@", url: (u) => `https://www.tiktok.com/@${u}`, texto: (u) => "@" + u },
  { rede: "youtube", rotulo: "YouTube", prefixo: "@", url: (u) => `https://www.youtube.com/@${u}`, texto: (u) => "@" + u },
];
export const rede = (r: Rede) => REDES.find((x) => x.rede === r)!;

/** Números conhecidos do Ari: o contato antigo vira WhatsApp com o nome de quem atende. */
const NOMES_CONHECIDOS: Record<string, string> = {
  "5512991196050": "WhatsApp - Ana Paula",
  "5512991167274": "WhatsApp - Ari",
};

const ehObjeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object";

/**
 * Formato antigo → novo, sem mudar o que o site mostra: o Zap de contato vira o geral (no rodapé);
 * o do KJ entra na lista fora do rodapé (hoje ele não aparece lá) e continua recebendo a comanda.
 * O formato novo passa direto.
 */
export function migraContato(x: unknown): Contato {
  const o = ehObjeto(x) ? x : {};
  if (Array.isArray(o.zaps)) return x as Contato;
  const geral = typeof o.zapContato === "string" ? o.zapContato : "";
  const zaps: ZapNomeado[] = [{ id: "z1", nome: NOMES_CONHECIDOS[geral] ?? "WhatsApp", numero: geral, ativo: true }];
  let kj: string | null = null;
  if (typeof o.zapKj === "string" && o.zapKj && o.zapKj !== geral) {
    zaps.push({ id: "z2", nome: NOMES_CONHECIDOS[o.zapKj] ?? "WhatsApp do KJ", numero: o.zapKj, ativo: false });
    kj = "z2";
  }
  const redes: PerfilRede[] = [];
  if (typeof o.instagram === "string" && o.instagram) redes.push({ id: "r1", rede: "instagram", usuario: o.instagram, ativo: true });
  if (typeof o.facebook === "string" && o.facebook) redes.push({ id: "r2", rede: "facebook", usuario: o.facebook, ativo: true });
  return { zaps, geral: "z1", kj, pedido: null, redes };
}

/** Número do WhatsApp escolhido; sem escolha (ou escolha que sumiu) = o geral. */
export function numeroDoZap(c: Contato, id: string | null): string {
  const geral = c.zaps.find((z) => z.id === c.geral) ?? c.zaps[0];
  return (id && c.zaps.find((z) => z.id === id)?.numero) || geral.numero;
}

export interface BlocoRodape { rotulo: string; itens: { texto: string; url: string; zap?: true }[] }

/** O rodapé do site: um bloco por WhatsApp ligado (na ordem do painel), depois um por rede com perfil ligado. */
export function blocosRodape(c: Contato, formata: (numero: string) => string): BlocoRodape[] {
  const zaps: BlocoRodape[] = c.zaps.filter((z) => z.ativo)
    .map((z) => ({ rotulo: z.nome, itens: [{ texto: formata(z.numero), url: `https://wa.me/${z.numero}`, zap: true }] }));
  const redes = REDES.map((r) => ({
    rotulo: r.rotulo,
    itens: c.redes.filter((p) => p.rede === r.rede && p.ativo).map((p) => ({ texto: r.texto(p.usuario), url: r.url(p.usuario) })),
  })).filter((b) => b.itens.length);
  return [...zaps, ...redes];
}
