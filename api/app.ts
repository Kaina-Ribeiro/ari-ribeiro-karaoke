import { createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { confereOrigem, exigeAdmin, exigeBuild } from "./auth.ts";
import { erro, ErroHttp } from "./resposta.ts";
import { registraAdmin } from "./rotas/admin.ts";
import { registraBuild } from "./rotas/build.ts";
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
registraAdmin(rota);
registraBuild(rota);

export async function handle(req: Request, env: Env, deps: Partial<Deps> = {}): Promise<Response> {
  const d: Deps = { ...depsPadrao, ...deps };
  const url = new URL(req.url);
  // a porta é checada antes da rota: quem não tem acesso não descobre nem o que existe
  if (url.pathname.startsWith("/api/admin/")) {
    const admin = await exigeAdmin(req, env, d);
    if (admin instanceof Response) return admin;
    const origem = confereOrigem(req);
    if (origem !== true) return origem;
  } else if (url.pathname.startsWith("/api/build/")) {
    const build = exigeBuild(req, env);
    if (build !== true) return build;
  }
  const achou = acha(req.method, url.pathname);
  if (achou === "metodo") return erro("Método não permitido", 405);
  if (!achou) return erro("Rota não encontrada", 404);
  try {
    return await achou.fn({ req, env, deps: d, url, params: achou.params });
  } catch (e) {
    if (e instanceof ErroHttp) return erro(e.message, e.status);
    console.error(e);
    return erro("Erro no servidor. Tente de novo.", 500);
  }
}
