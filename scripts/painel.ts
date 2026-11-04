/** Cliente da API do painel usado pelo build (rotas /api/build/*, com o BUILD_TOKEN). */
import type { ConfigBuild } from "../src/lib/painel/tipos.ts";
import type { Pacote } from "../src/lib/texto.ts";

const pausa = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

export interface CorpoStatus { publicacao?: number; status: "rodando" | "ok" | "falhou"; erro?: string; runUrl?: string; musicas?: number }

export function clientePainel(base: string, token: string, f: typeof fetch = fetch, espera: (ms: number) => Promise<void> = pausa) {
  const raiz = base.replace(/\/+$/, "");

  /** 3 tentativas pra rede e erro 5xx; erro 4xx é definitivo e mostra a mensagem da API. */
  async function pede(metodo: string, caminho: string, corpo?: unknown): Promise<Response> {
    for (let tentativa = 1; ; tentativa++) {
      let motivo: string;
      try {
        const r = await f(raiz + caminho, {
          method: metodo,
          headers: { Authorization: `Bearer ${token}`, ...(corpo === undefined ? {} : { "Content-Type": "application/json" }) },
          body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
        if (r.ok) return r;
        const msg = await r.json().then((j: { erro?: string }) => j.erro, () => undefined);
        motivo = `${msg ?? "erro"} (HTTP ${r.status})`;
        if (r.status < 500) throw new Error(`Painel recusou ${metodo} ${caminho}: ${motivo}`);
      } catch (e) {
        if ((e as Error).message.startsWith("Painel recusou")) throw e;
        motivo = (e as Error).message;
      }
      if (tentativa === 3) throw new Error(`Não consegui falar com o painel (${metodo} ${caminho}): ${motivo}`);
      await espera(2000 * tentativa);
    }
  }

  return {
    config: async (): Promise<ConfigBuild> => (await pede("GET", "/api/build/config")).json(),
    arquivo: async (chave: string): Promise<ArrayBuffer> => (await pede("GET", "/api/build/arquivo/" + chave)).arrayBuffer(),
    pacotes: async (lista: { nome: string; musicas: number }[]): Promise<Record<string, Pacote>> =>
      ((await (await pede("POST", "/api/build/pacotes", { pacotes: lista })).json()) as { classes: Record<string, Pacote> }).classes,
    status: async (c: CorpoStatus): Promise<{ publicacao: number }> => (await pede("POST", "/api/build/status", c)).json(),
  };
}
