/** Texto da faixa de status do painel (função pura: testada sem navegador). */
import type { Publicacao } from "../../../api/publicacoes.ts";

export type TipoStatus = "ok" | "publicando" | "demorando" | "falhou" | "nenhuma";

const DEMORA_MS = 10 * 60 * 1000;
const fuso = { timeZone: "America/Sao_Paulo" } as const;
const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { ...fuso, hour: "2-digit", minute: "2-digit" });
const dia = (d: Date) => d.toLocaleDateString("pt-BR", { ...fuso, day: "2-digit", month: "2-digit" });

/** "14:32" se foi hoje, "01/11 às 14:32" se foi outro dia. */
export function quando(iso: string, agora: Date): string {
  const d = new Date(iso);
  return dia(d) === dia(agora) ? hora(d) : `${dia(d)} às ${hora(d)}`;
}

export function textoStatus(p: Publicacao | null, agora: Date): { tipo: TipoStatus; texto: string } {
  if (!p) return { tipo: "nenhuma", texto: "Nada publicado pelo painel ainda." };
  if (p.status === "ok") return { tipo: "ok", texto: `No ar ✅ desde ${quando(p.terminouEm ?? p.pedidoEm, agora)}` };
  if (p.status === "falhou") {
    return { tipo: "falhou", texto: `Falhou ❌ ${p.erro ?? "O build falhou."} O site continua com a versão anterior.` };
  }
  if (agora.getTime() - new Date(p.pedidoEm).getTime() > DEMORA_MS) return { tipo: "demorando", texto: "Está demorando. Avisa o Gabriel." };
  return { tipo: "publicando", texto: "Publicando ⏳ leva uns 2 minutos." };
}

/** Nome do que gerou a publicação, pra tela de Início. */
export const MOTIVOS: Record<string, string> = {
  contato: "Contato", banner: "Banner", catalogo: "Catálogo", novidades: "Novidades", pacotes: "Novidades",
  cartoes: "Pra sua festa", diaria: "Checagem diária", "tentar-de-novo": "Tentar de novo",
  "atualizar-catalogo": "Atualizar catálogo", manual: "Publicação manual",
};
