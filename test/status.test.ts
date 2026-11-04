import { describe, expect, it } from "vitest";
import type { Publicacao } from "../api/publicacoes.ts";
import { textoStatus } from "../src/scripts/painel/status.ts";

const pub = (p: Partial<Publicacao>): Publicacao => ({
  id: 1, motivo: "contato", status: "ok", erro: null, runUrl: null, musicas: null,
  pedidoEm: "2026-11-04T17:30:00.000Z", terminouEm: "2026-11-04T17:32:00.000Z", ...p,
});
const agora = new Date("2026-11-04T17:40:00.000Z"); // 14:40 em Brasília

describe("textoStatus", () => {
  it("no ar, com o horário de Brasília", () => {
    const s = textoStatus(pub({}), agora);
    expect(s.tipo).toBe("ok");
    expect(s.texto).toContain("No ar ✅");
    expect(s.texto).toContain("14:32");
  });
  it("publicado em outro dia mostra a data", () => {
    expect(textoStatus(pub({ terminouEm: "2026-11-01T12:00:00.000Z" }), agora).texto).toContain("01/11");
  });
  it("publicando há pouco", () => {
    const s = textoStatus(pub({ status: "rodando", terminouEm: null, pedidoEm: "2026-11-04T17:38:00.000Z" }), agora);
    expect(s).toMatchObject({ tipo: "publicando" });
    expect(s.texto).toContain("Publicando ⏳");
  });
  it("publicando há mais de 10 minutos", () => {
    const s = textoStatus(pub({ status: "pendente", terminouEm: null, pedidoEm: "2026-11-04T17:29:00.000Z" }), agora);
    expect(s).toEqual({ tipo: "demorando", texto: "Está demorando. Avisa o Gabriel." });
  });
  it("falhou: motivo e o aviso de que o site continua como estava", () => {
    const s = textoStatus(pub({ status: "falhou", erro: "Planilha vazia." }), agora);
    expect(s.tipo).toBe("falhou");
    expect(s.texto).toContain("Falhou ❌");
    expect(s.texto).toContain("Planilha vazia.");
    expect(s.texto).toContain("O site continua com a versão anterior.");
  });
  it("nada publicado ainda", () => {
    expect(textoStatus(null, agora).tipo).toBe("nenhuma");
  });
});
