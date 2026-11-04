import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { erro, json } from "./resposta.ts";
import { criaRoteador } from "./roteador.ts";
import type { Deps, Env } from "./tipos.ts";

const chavesPorTime = new Map<string, JWTVerifyGetKey>();

export const depsPadrao: Deps = {
  chaves(env) {
    const time = env.ACCESS_TEAM ?? "";
    let k = chavesPorTime.get(time);
    if (!k) {
      k = createRemoteJWKSet(new URL(`https://${time}.cloudflareaccess.com/cdn-cgi/access/certs`));
      chavesPorTime.set(time, k);
    }
    return k;
  },
  agora: () => new Date(),
  fetch: (...a) => fetch(...a),
  aleatorio() {
    const b = crypto.getRandomValues(new Uint8Array(12));
    return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  },
};

const { rota, acha } = criaRoteador();
// as tarefas seguintes trocam estes por rotas de verdade
rota("GET", "/api/admin/estado", () => json({}));
rota("GET", "/api/build/config", () => json({}));

export async function handle(req: Request, env: Env, deps: Partial<Deps> = {}): Promise<Response> {
  const d: Deps = { ...depsPadrao, ...deps };
  const url = new URL(req.url);
  const achou = acha(req.method, url.pathname);
  if (achou === "metodo") return erro("Método não permitido", 405);
  if (!achou) return erro("Rota não encontrada", 404);
  try {
    return await achou.fn({ req, env, deps: d, url, params: achou.params });
  } catch (e) {
    console.error(e);
    return erro("Erro no servidor. Tente de novo.", 500);
  }
}
