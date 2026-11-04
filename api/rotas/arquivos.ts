import { hojeSP } from "../../src/lib/painel/classifica.ts";
import { normaliza } from "../../src/lib/texto.ts";
import { idDaPlanilha } from "../../src/lib/painel/valida.ts";
import { ErroHttp, json } from "../resposta.ts";
import type { criaRoteador } from "../roteador.ts";
import type { Env } from "../tipos.ts";

type Rota = ReturnType<typeof criaRoteador>["rota"];

const MB = 1024 * 1024;
const ascii = (b: Uint8Array, de: number, ate: number) => String.fromCharCode(...b.slice(de, ate));

/** Confere tamanho e os primeiros bytes; o nome e o tipo que o navegador diz não valem nada. */
const TIPOS = {
  planilha: {
    max: 10 * MB, nomeMax: "10 MB", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    assinatura: (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
    erro: "Esse arquivo não é um .xlsx.",
  },
  foto: {
    max: 2 * MB, nomeMax: "2 MB", contentType: "image/webp",
    assinatura: (b: Uint8Array) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
    erro: "Essa foto não está em WebP. Escolha a foto de novo.",
  },
} as const;

export const CHAVE_VALIDA = /^(planilhas|fotos)\/[\w.-]+$/;

/** Stream do R2 pra resposta HTTP. */
export async function serveArquivo(env: Env, chave: string): Promise<Response> {
  const obj = CHAVE_VALIDA.test(chave) ? await env.ARQUIVOS.get(chave) : null;
  if (!obj) throw new ErroHttp("Arquivo não encontrado", 404);
  return new Response(obj.body as unknown as ReadableStream, {
    headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" },
  });
}

/** Só a primeira linha do CSV: basta pra saber se a planilha é pública e tem as colunas (e gasta pouca CPU). */
async function primeiraLinha(r: Response): Promise<string> {
  if (!r.body) return "";
  const leitor = r.body.getReader();
  const dec = new TextDecoder();
  let txt = "";
  while (!txt.includes("\n") && txt.length < 10_000) {
    const { done, value } = await leitor.read();
    if (done) break;
    txt += dec.decode(value, { stream: true });
  }
  await leitor.cancel().catch(() => {});
  return txt.split("\n")[0];
}

export function registraArquivos(rota: Rota) {
  rota("POST", "/api/admin/arquivos", async ({ req, env, deps }) => {
    let form: FormData;
    try { form = await req.formData(); } catch { throw new ErroHttp("Envie o arquivo de novo.", 400); }
    const tipo = form.get("tipo");
    const arquivo = form.get("arquivo");
    if (tipo !== "planilha" && tipo !== "foto") throw new ErroHttp("Tipo de arquivo desconhecido.", 400);
    if (!arquivo || typeof arquivo === "string") throw new ErroHttp("Escolha um arquivo.", 400);
    const t = TIPOS[tipo];
    if (arquivo.size > t.max) throw new ErroHttp(`Arquivo grande demais (máximo ${t.nomeMax}).`, 413);
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (!t.assinatura(bytes)) throw new ErroHttp(t.erro, 415);
    const chave = tipo === "planilha" ? `planilhas/${hojeSP(deps.agora())}-${deps.aleatorio()}.xlsx` : `fotos/${deps.aleatorio()}.webp`;
    await env.ARQUIVOS.put(chave, bytes, { httpMetadata: { contentType: t.contentType } });
    return json({ chave });
  });

  rota("GET", "/api/admin/arquivos/:chave*", ({ env, params }) => serveArquivo(env, params.chave));

  rota("GET", "/api/admin/link/teste", async ({ url, deps }) => {
    const id = idDaPlanilha(url.searchParams.get("url") ?? "");
    if (!id) throw new ErroHttp("Cole o link da planilha do Google (docs.google.com/spreadsheets/...).", 400);
    const fechada = new ErroHttp("A planilha não está pública. Abra o compartilhamento no Google.", 422);
    let r: Response;
    try {
      r = await deps.fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Músicas")}`);
    } catch { throw fechada; }
    if (!r.ok) throw fechada;
    const colunas = normaliza((await primeiraLinha(r)).replace(/"/g, " ")).split(" ");
    if (!colunas.includes("codigo") || !colunas.includes("titulo")) throw fechada;
    return json({ ok: true, id });
  });
}
