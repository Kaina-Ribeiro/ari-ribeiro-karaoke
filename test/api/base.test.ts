import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criaAmbiente, reqBuild } from "./ambiente.ts";

let amb: Awaited<ReturnType<typeof criaAmbiente>>;
beforeAll(async () => { amb = await criaAmbiente(); });
afterAll(() => amb.fecha());

describe("base da API", () => {
  it("rota desconhecida dá 404 com mensagem em português", async () => {
    const r = await amb.chamar(new Request("http://localhost/api/nada"));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ erro: "Rota não encontrada" });
  });

  it("a migração cria as 4 tabelas", async () => {
    const { results } = await amb.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
    const nomes = results.map((t) => t.name);
    expect(nomes).toEqual(expect.arrayContaining(["config", "cartoes", "pacotes", "publicacoes"]));
  });

  it("método errado numa rota que existe dá 405", async () => {
    const r = await amb.chamar(reqBuild("POST", "/api/build/config"));
    expect(r.status).toBe(405);
    expect((await r.json()).erro).toBeTruthy();
  });
});
