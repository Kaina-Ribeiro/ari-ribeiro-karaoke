import { registraStatus, validaCorpoStatus } from "../publicacoes.ts";
import { json, leJson } from "../resposta.ts";
import type { criaRoteador } from "../roteador.ts";

type Rota = ReturnType<typeof criaRoteador>["rota"];

export function registraBuild(rota: Rota) {
  rota("GET", "/api/build/config", () => json({}));

  rota("POST", "/api/build/status", async ({ req, env, deps }) =>
    json(await registraStatus(env, deps, validaCorpoStatus(await leJson(req)))));
}
