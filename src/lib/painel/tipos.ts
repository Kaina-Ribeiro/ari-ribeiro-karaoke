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
