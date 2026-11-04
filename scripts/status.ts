/**
 * Conta pro painel como está a publicação (o GitHub Actions chama em cada etapa):
 *   node scripts/status.ts rodando|ok|falhou
 * Lê PAINEL_URL, BUILD_TOKEN, PUBLICACAO (vem do painel; vazio na checagem diária) e RUN_URL.
 * Sem PAINEL_URL (pull request), não faz nada. Nunca derruba o workflow: no máximo avisa no log.
 */
import { appendFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { clientePainel } from "./painel.ts";

type Status = "rodando" | "ok" | "falhou";
const GENERICO = "O build falhou. Veja o log no GitHub.";

export async function reporta(
  status: Status,
  env: Record<string, string | undefined>,
  opcoes: { raiz: string; fetch?: typeof fetch; manifesto?: string },
): Promise<number | null> {
  if (!env.PAINEL_URL || !env.BUILD_TOKEN) return null;
  const corpo: Parameters<ReturnType<typeof clientePainel>["status"]>[0] = { status, runUrl: env.RUN_URL };
  if (env.PUBLICACAO) corpo.publicacao = Number(env.PUBLICACAO);
  if (status === "ok") {
    const m = JSON.parse(await readFile(opcoes.manifesto ?? join(opcoes.raiz, "src/data/gerado/manifesto.json"), "utf8"));
    corpo.musicas = m.total;
  }
  if (status === "falhou") {
    corpo.erro = (await readFile(join(opcoes.raiz, ".erro-build.txt"), "utf8").catch(() => "")).trim() || GENERICO;
  }
  const { publicacao } = await clientePainel(env.PAINEL_URL, env.BUILD_TOKEN, opcoes.fetch).status(corpo);
  // checagem diária: o painel criou a publicação agora; as próximas etapas usam o mesmo id
  if (!env.PUBLICACAO && env.GITHUB_ENV) await appendFile(env.GITHUB_ENV, `PUBLICACAO=${publicacao}\n`);
  return publicacao;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const status = process.argv[2] as Status;
  if (!["rodando", "ok", "falhou"].includes(status)) {
    console.error("Use: node scripts/status.ts rodando|ok|falhou");
    process.exit(1);
  }
  try {
    const id = await reporta(status, process.env, { raiz: fileURLToPath(new URL("../", import.meta.url)) });
    console.log(id === null ? "Sem PAINEL_URL: nada a avisar." : `Painel avisado: publicação ${id} ${status}.`);
  } catch (e) {
    console.log(`::warning::Não consegui avisar o painel (${status}): ${(e as Error).message}`);
  }
}
