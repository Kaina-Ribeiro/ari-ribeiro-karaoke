import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, BUILD_TOKEN_TESTE, criaAmbiente, jwtDeTeste, reqAdmin, SITE } from "./ambiente.ts";

type Amb = Awaited<ReturnType<typeof criaAmbiente>>;
let amb: Amb, dev: Amb;
beforeAll(async () => {
  amb = await criaAmbiente();
  dev = await criaAmbiente({ env: { DEV_ADMIN_EMAIL: ADMIN } });
});
afterAll(async () => { await amb.fecha(); await dev.fecha(); });

const estado = (headers: Record<string, string> = {}, base = SITE) => new Request(base + "/api/admin/estado", { headers });

describe("admin (Cloudflare Access)", () => {
  it("sem JWT: 401", async () => {
    const r = await amb.chamar(estado());
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: "Faça login de novo." });
  });
  it("JWT válido com e-mail da lista: entra", async () => {
    expect((await amb.chamar(await reqAdmin("GET", "/api/admin/estado"))).status).toBe(200);
  });
  it("e-mail da lista em maiúsculas também entra", async () => {
    expect((await amb.chamar(estado({ "Cf-Access-Jwt-Assertion": await jwtDeTeste("Ari@Painel.test") }))).status).toBe(200);
  });
  it("e-mail fora da lista, aud errado ou expirado: 401", async () => {
    for (const jwt of [await jwtDeTeste("outro@x.com"), await jwtDeTeste(ADMIN, { aud: "outro" }), await jwtDeTeste(ADMIN, { expirado: true }), "lixo"]) {
      expect((await amb.chamar(estado({ "Cf-Access-Jwt-Assertion": jwt }))).status).toBe(401);
    }
  });
  it("login de teste vale em localhost", async () => {
    expect((await dev.chamar(estado({}, "http://localhost:8788"))).status).toBe(200);
    expect((await dev.chamar(estado({}, "http://127.0.0.1:8788"))).status).toBe(200);
  });
  it("login de teste NÃO vale fora de localhost, mesmo configurado", async () => {
    expect((await dev.chamar(estado({}, "https://abc.ari-ribeiro-karaoke.pages.dev"))).status).toBe(401);
  });
  it("Access sem time/aud configurado recusa", async () => {
    const semAccess = await criaAmbiente({ env: { ACCESS_TEAM: "", ACCESS_AUD: "" } });
    expect((await semAccess.chamar(await reqAdmin("GET", "/api/admin/estado"))).status).toBe(401);
    await semAccess.fecha();
  });
});

describe("mutações do admin", () => {
  it("Origin de outro site: 403", async () => {
    const req = await reqAdmin("PUT", "/api/admin/contato", {});
    const r = await amb.chamar(new Request(req, { headers: { ...Object.fromEntries(req.headers), Origin: "https://evil.com" } }));
    expect(r.status).toBe(403);
  });
  it("sem Origin: 403", async () => {
    const req = await reqAdmin("PUT", "/api/admin/contato", {});
    const h = new Headers(req.headers); h.delete("Origin");
    expect((await amb.chamar(new Request(req, { headers: h }))).status).toBe(403);
  });
  it("sem Content-Type JSON: 415", async () => {
    const req = await reqAdmin("PUT", "/api/admin/contato", {});
    const h = new Headers(req.headers); h.set("Content-Type", "text/plain");
    expect((await amb.chamar(new Request(req, { headers: h }))).status).toBe(415);
  });
});

describe("build (token)", () => {
  const config = (token?: string) => new Request(SITE + "/api/build/config", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  it("sem token: 401", async () => {
    expect((await amb.chamar(config())).status).toBe(401);
  });
  it("token errado do mesmo tamanho: 401", async () => {
    expect((await amb.chamar(config("c".repeat(64)))).status).toBe(401);
    expect((await amb.chamar(config("curto"))).status).toBe(401);
  });
  it("token certo: 200", async () => {
    expect((await amb.chamar(config(BUILD_TOKEN_TESTE))).status).toBe(200);
  });
  it("BUILD_TOKEN vazio no servidor nunca aceita", async () => {
    const semToken = await criaAmbiente({ env: { BUILD_TOKEN: "" } });
    expect((await semToken.chamar(new Request(SITE + "/api/build/config", { headers: { Authorization: "Bearer " } }))).status).toBe(401);
    await semToken.fecha();
  });
});
