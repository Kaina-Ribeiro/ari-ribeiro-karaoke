-- configurações simples, valor em JSON
--   contato    {zapContato, zapKj|null, instagram, facebook|null}
--   banner     {linhas:[l1,l2,l3], frase, legenda:[a,b], foto:{chave, recortada:boolean}}
--   catalogo   {fonte:"arquivo"|"link", link|null, arquivo:{chave, nome, enviadoEm, musicas, pacotes}|null}
--   novidades  {prazoDias}   -- padrão 60
CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL);

CREATE TABLE cartoes (
  id INTEGER PRIMARY KEY, ordem INTEGER NOT NULL, ativo INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL, destaque TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL,
  foto_chave TEXT, atualizado_em TEXT NOT NULL);

CREATE TABLE pacotes (
  chave TEXT PRIMARY KEY,          -- nome em maiúsculas, sem espaços nas pontas
  nome TEXT NOT NULL,              -- grafia como veio
  chegou_em TEXT NOT NULL,         -- primeira vez que um build viu o pacote (YYYY-MM-DD)
  musicas INTEGER NOT NULL, visto_em TEXT NOT NULL,
  modo TEXT NOT NULL DEFAULT 'auto' CHECK (modo IN ('auto','nova','exc','base')));

CREATE TABLE publicacoes (
  id INTEGER PRIMARY KEY, motivo TEXT NOT NULL,           -- "contato", "banner", "diaria"...
  status TEXT NOT NULL CHECK (status IN ('pendente','rodando','ok','falhou')),
  erro TEXT, run_url TEXT, musicas INTEGER,
  pedido_em TEXT NOT NULL, terminou_em TEXT);

CREATE INDEX publicacoes_status ON publicacoes(status, id);
