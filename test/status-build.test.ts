import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reporta } from "../scripts/status.ts";

let raiz: string;
beforeEach(async () => { raiz = await mkdtemp(join(tmpdir(), "status-")); });
afterEach(() => rm(raiz, { recursive: true, force: true }));

/** fetch falso: guarda os corpos e responde com a publicação 7. */
function painelFalso() {
  const corpos: Record<string, unknown>[] = [];
  const fetch = (async (_u: string, init: RequestInit) => {
    corpos.push(JSON.parse(String(init.body)));
    return Response.json({ publicacao: 7 });
  }) as unknown as typeof globalThis.fetch;
  return { corpos, fetch };
}
const env = (extra: Record<string, string> = {}) => ({ PAINEL_URL: "http://painel", BUILD_TOKEN: "t", RUN_URL: "https://github.com/x/actions/runs/1", ...extra });

describe("reporta", () => {
  it("rodando sem publicação (checagem diária) guarda o id criado no GITHUB_ENV", async () => {
    const p = painelFalso();
    const ghEnv = join(raiz, "github_env");
    await writeFile(ghEnv, "");
    expect(await reporta("rodando", env({ GITHUB_ENV: ghEnv }), { raiz, fetch: p.fetch })).toBe(7);
    expect(p.corpos).toEqual([{ status: "rodando", runUrl: "https://github.com/x/actions/runs/1" }]);
    expect(await readFile(ghEnv, "utf8")).toBe("PUBLICACAO=7\n");
  });

  it("ok manda quantas músicas foram pro ar", async () => {
    const p = painelFalso();
    await writeFile(join(raiz, "manifesto.json"), JSON.stringify({ total: 12345 }));
    await reporta("ok", env({ PUBLICACAO: "3" }), { raiz, fetch: p.fetch, manifesto: join(raiz, "manifesto.json") });
    expect(p.corpos[0]).toEqual({ status: "ok", publicacao: 3, musicas: 12345, runUrl: "https://github.com/x/actions/runs/1" });
  });

  it("falhou manda o motivo gravado pelo build, ou um genérico", async () => {
    const p = painelFalso();
    await writeFile(join(raiz, ".erro-build.txt"), "A aba Músicas veio vazia.\n");
    await reporta("falhou", env({ PUBLICACAO: "3" }), { raiz, fetch: p.fetch });
    await rm(join(raiz, ".erro-build.txt"));
    await reporta("falhou", env({ PUBLICACAO: "3" }), { raiz, fetch: p.fetch });
    expect(p.corpos.map((c) => c.erro)).toEqual(["A aba Músicas veio vazia.", "O build falhou. Veja o log no GitHub."]);
  });

  it("sem PAINEL_URL (pull request) não faz nada", async () => {
    const p = painelFalso();
    expect(await reporta("rodando", {}, { raiz, fetch: p.fetch })).toBeNull();
    expect(p.corpos).toEqual([]);
  });
});
