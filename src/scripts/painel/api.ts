/** Conversa com /api/admin/*. Erros viram ErroApi com a mensagem pronta pra mostrar ao Ari. */
export class ErroApi extends Error {
  constructor(mensagem: string, readonly status: number) { super(mensagem); }
}

export const SEM_CONEXAO = "Sem conexão com o servidor. Confira a internet e tente de novo.";

export async function api<T>(metodo: string, rota: string, corpo?: unknown): Promise<T> {
  const multipart = corpo instanceof FormData;
  let r: Response;
  try {
    r = await fetch(rota, {
      method: metodo,
      // o Access redireciona pro login quando a sessão vence; sem isso o fetch só "falharia"
      redirect: "manual",
      headers: multipart || metodo === "GET" ? {} : { "Content-Type": "application/json" },
      body: multipart ? corpo : corpo === undefined ? (metodo === "GET" ? undefined : "{}") : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(SEM_CONEXAO, 0);
  }
  if (r.type === "opaqueredirect") {
    location.reload(); // o Access mostra a tela de login
    throw new ErroApi("Faça login de novo.", 401);
  }
  if (r.status === 401) throw new ErroApi("Seu e-mail não tem acesso ao painel. Fale com o Gabriel.", 401);
  const dados = await r.json().catch(() => null);
  if (!r.ok) throw new ErroApi((dados as { erro?: string } | null)?.erro ?? `Algo deu errado (erro ${r.status}). Tente de novo.`, r.status);
  return dados as T;
}
