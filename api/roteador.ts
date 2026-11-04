import type { Deps, Env } from "./tipos.ts";

export interface Contexto {
  req: Request;
  env: Env;
  deps: Deps;
  url: URL;
  params: Record<string, string>;
}
export type Handler = (c: Contexto) => Response | Promise<Response>;

interface Rota { metodo: string; re: RegExp; nomes: string[]; fn: Handler }

/**
 * Padrões como "/api/admin/cartoes/:id". ":nome*" casa com o resto do caminho, barras incluídas
 * (chaves do R2 são "fotos/abc.webp").
 */
export function criaRoteador() {
  const rotas: Rota[] = [];
  function rota(metodo: string, padrao: string, fn: Handler) {
    const nomes: string[] = [];
    const fonte = padrao.split("/").map((seg) => {
      const m = /^:(\w+)(\*?)$/.exec(seg);
      if (!m) return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      nomes.push(m[1]);
      return m[2] ? "(.+)" : "([^/]+)";
    }).join("/");
    rotas.push({ metodo, re: new RegExp(`^${fonte}$`), nomes, fn });
  }
  /** Rota pro método e caminho; `"metodo"` se o caminho existe com outro método. */
  function acha(metodo: string, caminho: string): { fn: Handler; params: Record<string, string> } | "metodo" | null {
    let outroMetodo = false;
    for (const r of rotas) {
      const m = r.re.exec(caminho);
      if (!m) continue;
      if (r.metodo !== metodo) { outroMetodo = true; continue; }
      const params: Record<string, string> = {};
      try {
        r.nomes.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
      } catch { return null; } // %E0 solto: caminho inválido
      return { fn: r.fn, params };
    }
    return outroMetodo ? "metodo" : null;
  }
  return { rota, acha };
}
