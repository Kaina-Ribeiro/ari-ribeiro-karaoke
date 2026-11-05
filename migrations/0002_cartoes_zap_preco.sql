-- Fase 2: cada cartão de "Pra sua festa" escolhe o seu WhatsApp e pode ter preço.
--   zap_id  id de um WhatsApp do contato (config "contato".zaps[].id); NULL = o geral
--   preco   JSON {texto, cor, tamanho, peso}; NULL = sem preço (o cartão fica como antes)
-- Os cartões que já existem ficam com os dois NULL: o site não muda.
ALTER TABLE cartoes ADD COLUMN zap_id TEXT;
ALTER TABLE cartoes ADD COLUMN preco TEXT;
