import { REDES } from "./contato.ts";
import { CORES_PRECO, ESTILO_PRECO_PADRAO, PESOS_PRECO, TAMANHOS_PRECO } from "./preco.ts";
import type { Banner, Cartao, Contato, Novidades, PerfilRede, PrecoCartao, Resultado, ZapNomeado } from "./tipos.ts";

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const falha = <T = never>(erro: string): Resultado<T> => ({ ok: false, erro });

/** Letras como a pessoa vê: "ç" decomposto (macOS) conta como uma. */
export const tamanho = (s: string): number => [...s.normalize("NFC")].length;
const texto = (x: unknown): string => (typeof x === "string" ? x.normalize("NFC").trim() : "");
const objeto = (x: unknown): Record<string, unknown> => (x && typeof x === "object" ? (x as Record<string, unknown>) : {});

const ERRO_ZAP = "Use um celular com DDD: (12) 99999-9999";

/** Aceita o número colado de qualquer jeito e guarda como 55DDNNNNNNNNN. Só celular. */
export function normalizaZap(s: string): Resultado<string> {
  let d = s.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("0")) d = d.slice(1);
  if (!/^[1-9]{2}9\d{8}$/.test(d)) return falha(ERRO_ZAP);
  return ok("55" + d);
}

export function formataZap(z: string): string {
  const d = z.replace(/^55/, "");
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * O que o Ari vê enquanto digita: "(12) 99119-6050". Separadores só aparecem quando vem o próximo dígito,
 * assim apagar do fim nunca trava. "+55", "55" ou "0" na frente (número colado) somem.
 */
export function mascaraZap(s: string): string {
  let d = s.replace(/\D/g, "").slice(0, 13);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11 && d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return "(" + d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const HOSTS_REDES = /^(https?:\/\/)?(www\.|m\.|mobile\.|web\.)?(instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com|tiktok\.com|youtube\.com)\//i;

/** "@ari", "instagram.com/ari/", "tiktok.com/@ari" e "ari" viram "ari". */
export function normalizaUsuario(s: string): Resultado<string> {
  const u = s.trim()
    .replace(HOSTS_REDES, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(u)) return falha("Use só o nome de usuário, sem espaços (ex.: ariribeirokaraoke)");
  return ok(u);
}

export const MAX_ZAPS = 10;
export const MAX_REDES = 20;
export const LIMITE_NOME_ZAP = 40;
const ID = /^[a-z0-9]{1,24}$/;

/**
 * Erros com o campo do painel na frente ("zap-numero:z1|mensagem"), pra tela pôr a mensagem no lugar certo.
 * `campoDoErro` separa os dois.
 */
const falhaEm = (campo: string, erro: string) => falha<Contato>(`${campo}|${erro}`);
export const campoDoErro = (erro: string): { campo: string | null; mensagem: string } => {
  const i = erro.indexOf("|");
  return i < 0 ? { campo: null, mensagem: erro } : { campo: erro.slice(0, i), mensagem: erro.slice(i + 1) };
};

export function validaContato(x: unknown): Resultado<Contato> {
  const o = objeto(x);
  const zs = Array.isArray(o.zaps) ? o.zaps : [];
  if (!zs.length) return falha("Cadastre pelo menos um WhatsApp");
  if (zs.length > MAX_ZAPS) return falha(`Cabem até ${MAX_ZAPS} WhatsApp`);
  const zaps: ZapNomeado[] = [];
  for (const [i, z] of zs.entries()) {
    const zo = objeto(z);
    const id = texto(zo.id);
    if (!ID.test(id) || zaps.some((y) => y.id === id)) return falha("A lista de WhatsApp veio errada. Recarregue a página.");
    const nome = texto(zo.nome);
    const qual = `WhatsApp ${i + 1}`;
    if (!nome) return falhaEm(`zap-nome-${id}`, `Dê um nome pro ${qual} (ex.: WhatsApp - Ana Paula)`);
    if (tamanho(nome) > LIMITE_NOME_ZAP) return falhaEm(`zap-nome-${id}`, `O nome pode ter até ${LIMITE_NOME_ZAP} letras`);
    const numero = normalizaZap(texto(zo.numero));
    if (!numero.ok) return falhaEm(`zap-numero-${id}`, numero.erro);
    if (zaps.some((y) => y.numero === numero.valor)) return falhaEm(`zap-numero-${id}`, "Esse número já está na lista");
    zaps.push({ id, nome, numero: numero.valor, ativo: zo.ativo !== false });
  }
  const existe = (v: unknown) => (typeof v === "string" && zaps.some((z) => z.id === v) ? v : null);
  const geral = existe(o.geral);
  if (!geral) return falha("Escolha qual WhatsApp é o geral");
  // o geral sempre aparece no rodapé: é o padrão de todos os botões
  zaps.find((z) => z.id === geral)!.ativo = true;
  const destino = (v: unknown, campo: string, nome: string): Resultado<string | null> => {
    if (v === null || v === undefined || v === "") return ok(null);
    const id = existe(v);
    return id ? ok(id === geral ? null : id) : falha(`${campo}|Escolha de novo quem recebe ${nome}`);
  };
  const kj = destino(o.kj, "kj", "a comanda");
  if (!kj.ok) return falha(kj.erro);
  const pedido = destino(o.pedido, "pedido", "o pedido de música nova");
  if (!pedido.ok) return falha(pedido.erro);

  const rs = Array.isArray(o.redes) ? o.redes : [];
  if (rs.length > MAX_REDES) return falha(`Cabem até ${MAX_REDES} perfis de redes sociais`);
  const redes: PerfilRede[] = [];
  for (const r of rs) {
    const ro = objeto(r);
    const id = texto(ro.id);
    const qual = REDES.find((x) => x.rede === ro.rede);
    if (!ID.test(id) || redes.some((y) => y.id === id) || !qual) return falha("A lista de redes veio errada. Recarregue a página.");
    const u = normalizaUsuario(texto(ro.usuario));
    if (!u.ok) return falhaEm(`rede-${id}`, `${qual.rotulo}: ${u.erro}`);
    redes.push({ id, rede: qual.rede, usuario: u.valor, ativo: ro.ativo !== false });
  }
  return ok({ zaps, geral, kj: kj.valor, pedido: pedido.valor, redes });
}

export const LIMITES = { linha: 14, frase: 80, legenda: [16, 30], titulo: 40, destaque: 30, descricao: 160, preco: 30 } as const;

export function validaBanner(x: unknown): Resultado<Banner> {
  const o = objeto(x);
  const ls = Array.isArray(o.linhas) ? o.linhas : [];
  const linhas = [0, 1, 2].map((i) => texto(ls[i])) as Banner["linhas"];
  if (!linhas[0]) return falha("A linha 1 da frase grande é obrigatória");
  for (let i = 0; i < 3; i++) {
    if (tamanho(linhas[i]) > LIMITES.linha) return falha(`A linha ${i + 1} pode ter até ${LIMITES.linha} letras`);
  }
  const frase = texto(o.frase);
  if (!frase) return falha("A frase de baixo é obrigatória");
  if (tamanho(frase) > LIMITES.frase) return falha(`A frase de baixo pode ter até ${LIMITES.frase} letras`);
  const lg = Array.isArray(o.legenda) ? o.legenda : [];
  const legenda = [texto(lg[0]), texto(lg[1])] as Banner["legenda"];
  for (let i = 0; i < 2; i++) {
    if (tamanho(legenda[i]) > LIMITES.legenda[i]) return falha(`A legenda ${i + 1} pode ter até ${LIMITES.legenda[i]} letras`);
  }
  const f = objeto(o.foto);
  if (typeof f.chave !== "string" || !f.chave) return falha("Escolha uma foto para o banner");
  return ok({ linhas, frase, legenda, foto: { chave: f.chave, recortada: f.recortada === true } });
}

export function validaCartao(x: unknown): Resultado<Omit<Cartao, "id" | "ordem">> {
  const o = objeto(x);
  const titulo = texto(o.titulo), destaque = texto(o.destaque), descricao = texto(o.descricao);
  if (!titulo) return falha("O título do cartão é obrigatório");
  if (tamanho(titulo) > LIMITES.titulo) return falha(`O título pode ter até ${LIMITES.titulo} letras`);
  if (tamanho(destaque) > LIMITES.destaque) return falha(`O destaque pode ter até ${LIMITES.destaque} letras`);
  if (!descricao) return falha("A descrição do cartão é obrigatória");
  if (tamanho(descricao) > LIMITES.descricao) return falha(`A descrição pode ter até ${LIMITES.descricao} letras`);
  const fotoChave = typeof o.fotoChave === "string" && o.fotoChave ? o.fotoChave : null;
  // só o formato: um id que não está (ou deixou de estar) no Contato vai pro geral na hora de publicar
  const zapId = typeof o.zapId === "string" && ID.test(o.zapId) ? o.zapId : null;
  const preco = validaPreco(o.preco);
  if (!preco.ok) return falha(preco.erro);
  return ok({ ativo: o.ativo !== false, titulo, destaque, descricao, fotoChave, zapId, preco: preco.valor });
}

/** Preço vazio = sem preço. Estilo que não está na lista vira o padrão (nunca trava o Salvar). */
export function validaPreco(x: unknown): Resultado<PrecoCartao | null> {
  const o = objeto(x);
  const t = texto(o.texto).replace(/\s+/g, " ");
  if (!t) return ok(null);
  if (tamanho(t) > LIMITES.preco) return falha(`O preço pode ter até ${LIMITES.preco} letras`);
  const de = <T extends string>(lista: { valor: T }[], v: unknown, padrao: T): T => lista.find((i) => i.valor === v)?.valor ?? padrao;
  return ok({
    texto: t,
    cor: de(CORES_PRECO, o.cor, ESTILO_PRECO_PADRAO.cor),
    tamanho: de(TAMANHOS_PRECO, o.tamanho, ESTILO_PRECO_PADRAO.tamanho),
    peso: de(PESOS_PRECO, o.peso, ESTILO_PRECO_PADRAO.peso),
  });
}

export function validaNovidades(x: unknown): Resultado<Novidades> {
  const p = objeto(x).prazoDias;
  if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 365) return falha("O prazo precisa ser de 1 a 365 dias");
  return ok({ prazoDias: p });
}

/** Id da planilha só se o link for mesmo do Google Sheets. */
export function idDaPlanilha(url: string): string | null {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.hostname !== "docs.google.com") return null;
  const m = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})(\/|$)/.exec(u.pathname);
  return m ? m[1] : null;
}
