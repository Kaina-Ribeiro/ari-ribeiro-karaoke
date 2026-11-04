export function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const erro = (mensagem: string, status: number): Response => json({ erro: mensagem }, status);

/** Erro que vira resposta {erro} com o status HTTP dado (o handle converte). */
export class ErroHttp extends Error {
  constructor(mensagem: string, readonly status: number) { super(mensagem); }
}

export async function leJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new ErroHttp("Os dados enviados não são JSON válido.", 400); }
}
