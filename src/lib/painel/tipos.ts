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

/** Zaps guardados como 55DDNNNNNNNNN; redes só com o nome de usuário. */
export interface Contato {
  zapContato: string;
  /** null = usa o Zap de contato */
  zapKj: string | null;
  instagram: string;
  facebook: string | null;
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

export interface Cartao {
  id: number;
  ordem: number;
  ativo: boolean;
  titulo: string;
  destaque: string;
  descricao: string;
  fotoChave: string | null;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };
