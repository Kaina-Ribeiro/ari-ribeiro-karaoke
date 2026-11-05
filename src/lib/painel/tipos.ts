/** Tipos da configuração do painel, divididos entre navegador, build e API. */

/** "auto" segue a data de chegada; os outros são a escolha manual do Ari, que sempre vence. */
export type Modo = "auto" | "nova" | "exc" | "base";

export interface PacoteDb {
  chave: string;
  nome: string;
  chegouEm: string;
  musicas: number;
  vistoEm: string;
  modo: Modo;
}

/** Um WhatsApp da lista. `ativo` = aparece no rodapé; mesmo fora do rodapé ele pode receber a comanda ou os pedidos. */
export interface ZapNomeado {
  /** fixo: é por ele que a comanda, o "Pedir música nova" e (Fase 2) os cartões apontam */
  id: string;
  /** "WhatsApp - Ana Paula": o rótulo no rodapé */
  nome: string;
  /** 55DDNNNNNNNNN */
  numero: string;
  ativo: boolean;
}

export type Rede = "instagram" | "facebook" | "x" | "tiktok" | "youtube";

/** Um perfil de rede social, só com o nome de usuário. `ativo` = aparece no rodapé. */
export interface PerfilRede { id: string; rede: Rede; usuario: string; ativo: boolean }

/** Ordem de `zaps` = ordem no rodapé. Destinos guardam o id de um WhatsApp da lista; null = o geral. */
export interface Contato {
  zaps: ZapNomeado[];
  /** obrigatório e sempre no rodapé: padrão de todos os botões */
  geral: string;
  /** recebe a comanda */
  kj: string | null;
  /** recebe o "Pedir música nova" (busca sem resultado) */
  pedido: string | null;
  redes: PerfilRede[];
}

export interface Banner {
  /** frase grande, 3 linhas (as de baixo podem ficar vazias) */
  linhas: [string, string, string];
  /** frase de baixo; *palavra* fica em negrito */
  frase: string;
  legenda: [string, string];
  /** recortada = fundo transparente, aparece "saindo" do pôster como a foto de hoje */
  foto: { chave: string; recortada: boolean };
}

export interface FonteCatalogo {
  fonte: "arquivo" | "link";
  link: string | null;
  arquivo: { chave: string; nome: string; enviadoEm: string; musicas: number; pacotes: number; forcar?: boolean } | null;
}

export interface Novidades { prazoDias: number }

/** Cores do site pra etiqueta de preço (o fundo; a letra escolhe a que dá contraste). */
export type CorPreco = "tinta" | "gravata" | "brasa" | "luz" | "papel";
export type TamanhoPreco = "p" | "m" | "g";
export type PesoPreco = "normal" | "forte" | "extra";

/** Preço do cartão, texto livre ("a partir de R$ 350") numa etiqueta com o estilo escolhido. */
export interface PrecoCartao { texto: string; cor: CorPreco; tamanho: TamanhoPreco; peso: PesoPreco }

export interface Cartao {
  id: number;
  ordem: number;
  ativo: boolean;
  titulo: string;
  destaque: string;
  descricao: string;
  fotoChave: string | null;
  /** id de um WhatsApp do Contato; null = o geral (id que sumiu também vira o geral) */
  zapId: string | null;
  /** null = sem preço: o cartão fica como sempre foi */
  preco: PrecoCartao | null;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

/** O que o build recebe da API (GET /api/build/config) ou de data/fixture/config.json (offline). */
export interface ConfigBuild {
  contato: Contato;
  banner: Banner;
  catalogo: FonteCatalogo;
  novidades: Novidades;
  /** só os ativos, em ordem */
  cartoes: Cartao[];
  pacotes: PacoteDb[];
  musicasNoAr: number | null;
  hoje: string;
}
