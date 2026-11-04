import type { PagesFunction } from "@cloudflare/workers-types/index.ts";
import { handle } from "../../api/app.ts";
import type { Env } from "../../api/tipos.ts";

// Toda a API mora em api/; aqui só entra a requisição.
export const onRequest: PagesFunction<Env> = (c) =>
  handle(c.request as unknown as Request, c.env) as unknown as ReturnType<PagesFunction<Env>>;
