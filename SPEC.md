# SPEC · Painel do Ari

Data: 2026-11-04 · Autor: Gabriel (com Claude) · Status: **aguardando revisão**

## 1. Objetivo

O Ari (dono do karaokê) passa a controlar o conteúdo do site sozinho, por um painel com login. Hoje tudo está fixo no código ou vem da planilha do Google.

**Pronto quando:**
- o Ari entra em `/admin` com código no e-mail e muda: fonte do catálogo (arquivo `.xlsx` ou link), Novidades e Só no Ari, banner (textos e foto), cartões de "Pra sua festa", WhatsApp e redes;
- cada "Salvar" publica o site em ~2 min e o painel mostra se deu certo;
- no dia da troca, o site fica idêntico ao de hoje;
- o botão "Mandar pro KJ" só funciona com pelo menos 1 música na comanda.

## 2. Decisões (não reabrir)

| # | Decisão | Motivo |
|---|---|---|
| D1 | Backend na própria Cloudflare (Pages Functions + D1 + R2), sem VPS | Grátis, mesmo domínio, nada a manter no ar |
| D2 | Site continua **estático**; publica quando o Ari salva (sem SSR/revalidação) | O Ari edita poucas vezes por mês; se a API cair, o site continua no ar |
| D3 | Catálogo: o Ari **escolhe** entre upload de `.xlsx` ou link do Google Sheets | Pedido do Gabriel |
| D4 | Modo link: botão "Atualizar catálogo" + checagem **diária** (era de hora em hora) | A planilha muda sem avisar ninguém |
| D5 | Login: Cloudflare Access com código de 6 dígitos no e-mail | Zero código de login nosso; grátis até 50 pessoas |
| D6 | Novidades automáticas pela **data de chegada** do pacote, com prazo configurável; o manual sempre vence | A planilha não tem data; os códigos têm duas sequências |
| D7 | Cartões de festa saem da aba Produtos e vão para o painel, com **foto opcional** (sem preço) | Um lugar só para editar; preço desatualizado gera atrito |
| D8 | Banner todo editável, inclusive a frase grande (3 linhas com limite) | Pedido do Gabriel; estilo aplicado sozinho |
| D9 | Dois WhatsApp: **Contato** (obrigatório) e **KJ** (opcional, cai no Contato) | Quem opera o som pode não ser o Ari |
| D10 | `.xlsx` é lido no navegador (prévia) e no build, nunca no Worker | Worker grátis tem 10 ms de CPU por requisição |
| D11 | Visual do site não muda, exceto o cartão de festa com foto | O Ari já aprovou o layout |

## 3. Arquitetura

```
/            site estático (Astro)                 ← igual hoje, dados vêm do painel
/admin       página estática do painel (Astro)     ← protegida pelo Cloudflare Access
/api/admin/* Pages Functions                       ← Access + verificação do JWT + lista de e-mails
/api/build/* Pages Functions                       ← token secreto (só o GitHub Actions)
D1           configurações, cartões, pacotes, publicações
R2           .xlsx enviado, fotos (banner e cartões)
```

**Salvar no painel:**
`Painel → PUT /api/admin/... (grava D1/R2) → cria publicação "pendente" → workflow_dispatch no GitHub → Actions: GET /api/build/config → lê .xlsx (R2) ou link → gera site → POST /api/build/status → publica → painel mostra "No ar ✅"`

**Upload do `.xlsx`:**
`Ari escolhe o arquivo → navegador lê com a mesma biblioteca do build → prévia (músicas, pacotes, pacotes novos, avisos) → Ari confirma → POST /api/admin/arquivos → R2 → publica`

- Pages Functions ficam em `functions/` (fora do Astro). O Astro continua com `output: "static"`. O `wrangler pages deploy dist` empacota `functions/` junto.
- Bindings em `wrangler.toml`: `DB` (D1) e `ARQUIVOS` (R2), com recursos **separados** para produção e preview.
- Biblioteca de `.xlsx`: **SheetJS** (`xlsx` 0.20.3, tarball oficial de `cdn.sheetjs.com`), usada no navegador e no Node.
- Verificação do JWT do Access: biblioteca `jose`.

## 4. Dados

### D1

```sql
-- configurações simples, valor em JSON
CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL);
--   contato    {zapContato, zapKj|null, instagram, facebook|null}
--   banner     {linhas:[l1,l2,l3], frase, legenda:[a,b], foto:{chave, recortada:boolean}}
--   catalogo   {fonte:"arquivo"|"link", link|null, arquivo:{chave, nome, enviadoEm, musicas, pacotes}|null}
--   novidades  {prazoDias}   -- padrão 60

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
```

### R2
- Chaves geradas pelo servidor: `planilhas/<data>-<aleatório>.xlsx`, `fotos/<aleatório>.webp` (ou `.jpg`/`.png`, ver Fotos no §6). Nunca o nome do arquivo do usuário.
- Arquivos antigos ficam (custo irrisório). Limpeza fica fora do escopo.

### Classificação de pacote (função pura, testada)

```
classifica(pacote, prazoDias, hoje):
  modo != 'auto'                              → modo
  nome vazio ou "ARI RIBEIRO KARAOKE"         → base
  nome contém "EXCLUSIVO"                     → exc
  hoje - chegou_em < prazoDias                → nova
  senão                                       → base
```

O resultado entra no catálogo no mesmo formato de hoje (`base | nova | exc`). O código do navegador não muda.

## 5. API

Todas as respostas são JSON. Erros: `{erro: "mensagem em português"}` + status HTTP.

**Admin** (Access + JWT válido + e-mail em `ADMIN_EMAILS`; mutações exigem `Content-Type: application/json` ou multipart e `Origin` do próprio site):

| Método | Rota | Faz |
|---|---|---|
| GET | `/api/admin/estado` | Tudo: config, cartões, pacotes (com classificação atual), última publicação |
| PUT | `/api/admin/contato` · `/banner` · `/catalogo` · `/novidades` | Valida, grava, publica |
| PUT | `/api/admin/pacotes/:chave` | `{modo}`, publica |
| POST · PUT · DELETE | `/api/admin/cartoes[/:id]` | CRUD, publica |
| PUT | `/api/admin/cartoes/ordem` | `{ids:[...]}`, publica |
| POST | `/api/admin/arquivos` | Multipart `tipo=planilha|foto`. Confere tamanho e assinatura do arquivo. Devolve `{chave}` |
| GET | `/api/admin/arquivos/:chave` | Serve do R2 (prévia no painel) |
| GET | `/api/admin/link/teste?url=` | Aceita só links `docs.google.com/spreadsheets/d/<id>`; extrai o id e confere se a aba "Músicas" responde (planilha pública) |
| POST | `/api/admin/publicar` | "Tentar de novo" / "Atualizar catálogo" |

**Build** (`Authorization: Bearer <BUILD_TOKEN>`, comparação em tempo constante):

| Método | Rota | Faz |
|---|---|---|
| GET | `/api/build/config` | Config + cartões + pacotes + `musicasNoAr` (última publicação ok) |
| GET | `/api/build/arquivo/:chave` | Stream do R2 |
| POST | `/api/build/pacotes` | `{pacotes:[{nome, musicas}]}`. Novos ganham `chegou_em = hoje`. Devolve a classificação |
| POST | `/api/build/status` | `{publicacao, status, erro?, runUrl?, musicas?}`. Sem `publicacao` (checagem diária), cria uma |

**Validação:**
- Zap: celular brasileiro (DDD + 9 dígitos), guardado como `55DDNNNNNNNNN`, mostrado como `(12) 99116-7274`.
- Instagram/Facebook: só o usuário (`ariribeirokaraoke`); o link é montado pelo site.
- Banner: cada linha da frase com até **14** caracteres; frase de baixo até 80; legenda até 16 e 30. Obrigatórios: linha 1, frase de baixo.
- Cartão: título até 40, destaque até 30, descrição até 160.
- Upload: `.xlsx` até 10 MB; foto até 2 MB (já comprimida no navegador).

**Disparo do build:** `POST https://api.github.com/repos/Kaina-Ribeiro/ari-ribeiro-karaoke/actions/workflows/site.yml/dispatches` com `{ref: GH_REF, inputs: {publicacao}}` (workflow_dispatch: o token só precisa de `Actions: write`; `repository_dispatch` exigiria `Contents: write`). `GH_REF` é `main` em produção e `painel` em preview, então o painel de preview publica o deploy de preview, nunca a produção. Em dev (sem `GH_DISPATCH_TOKEN`), a publicação é marcada `ok` com `erro: "simulado em dev"`; para ver o site com os dados do painel local, `PAINEL_URL=http://localhost:8788 pnpm build`.

**Publicações substituídas:** o grupo de concorrência do Actions cancela runs da fila quando chega uma mais nova. Quando uma publicação termina `ok`, todas as anteriores ainda `pendente`/`rodando` também viram `ok` (substituídas).

## 6. Painel (`/admin`)

Celular primeiro, com o visual do site (cores, fontes). Abas embaixo da tela no celular e na lateral no computador. Estados de toque/hover/carregando em todos os botões.

**Faixa de status (todas as telas):** No ar ✅ (horário) · Publicando ⏳ · Falhou ❌ (motivo + "Tentar de novo"; "o site continua com a versão anterior"). Publicando por mais de 10 min → "Está demorando. Avisa o Gabriel." O painel consulta `/api/admin/estado` a cada 10 s enquanto houver publicação aberta.

| Tela | Conteúdo |
|---|---|
| **Início** | Status, última publicação, "Ver site", atalhos |
| **Catálogo** | Fonte: Arquivo / Link. Arquivo: escolher `.xlsx` → prévia (nº de músicas, pacotes, pacotes novos, linhas ignoradas) → Confirmar. Link: colar endereço → "Testar" → Salvar; botão "Atualizar catálogo" |
| **Novidades** | Prazo do automático (dias). Lista de pacotes: nome, chegada, nº de músicas, classificação atual, seletor Automático/Novidade/Só no Ari/Normal. Busca por nome. Filtro "só os que estão como Novidade" |
| **Banner** | 3 linhas (contador), frase de baixo, legenda (2 campos), foto. Prévia celular/computador com a mesma CSS do site |
| **Pra sua festa** | Lista: criar, editar, ligar/desligar, apagar (com confirmação), ↑↓ para reordenar, foto opcional |
| **Contato** | Zap de contato, Zap do KJ (opcional), Instagram, Facebook (opcional) |

**Fotos:** comprimidas no navegador (canvas → `.webp`, lado maior 1200 px, qualidade 0.82; onde o navegador não gera WebP, como o Safari e todo iPhone, vai `.jpg` para foto comum e `.png` para fundo transparente; acima de 2 MB, diminui e tenta de novo). O navegador detecta transparência: com fundo transparente → `recortada: true` (aparece como hoje); sem → enquadrada no pôster.

**Trava contra arquivo errado:** se a prévia tiver menos de 50% de `musicasNoAr`, o painel pede confirmação extra; o build recusa publicar abaixo de 50% salvo `catalogo.arquivo.forcar = true`, gravado nessa confirmação e apagado na publicação seguinte.

## 7. Site

1. **Comanda (Fase 0):** com 0 músicas, "Mandar pro KJ" fica com `aria-disabled="true"`, aparência apagada, sem `href` para o Zap; tocar mostra o aviso "Põe pelo menos 1 música na comanda". Com 1+, igual hoje. Arquivo: `src/scripts/catalogo.ts` (`desenhaComanda`) e `global.css`.
2. **Fim dos valores fixos:** `ZAP` sai de `index.astro` e `catalogo.ts`. O manifesto passa a ter `contato`, `banner` e `servicos` (com `foto`). O Zap do KJ chega ao navegador pelo `<script id="manifesto">`.
   - Zap do KJ: comanda, "Pedir pro KJ".
   - Zap de contato: cartões de festa, rodapé, "Pedir música nova".
3. **Banner:** cada linha vira `<span class="l">` com uma `<span class="w">` por palavra (a bolinha continua). Última linha com `serif`, última palavra com `ouro`. Foto `recortada` → como hoje; senão → `object-fit: cover` na área do pôster.
4. **Cartão com foto:** foto 16:9 no topo do cartão; sem foto, idêntico a hoje. Antes/depois lado a lado antes de fechar.
5. **Build (`scripts/planilha.ts`):**
   - Online: `GET /api/build/config` → fonte `arquivo` (baixa do R2, lê aba "Músicas" com SheetJS) ou `link` (CSV do Google, como hoje) → `POST /api/build/pacotes` → classifica → gera JSONs.
   - Offline (`--offline`): `data/fixture/config.json` + CSVs de hoje. Sem rede.
   - Fotos do R2 são baixadas para `public/img/painel/<hash>.<extensão>` (o site não depende do R2).
   - Limpeza de dados atual (`montaMusicas`) vale para as duas fontes.
   - `versao.txt` inclui a config.
   - Recusa publicar se músicas < 50% de `musicasNoAr` (sem `forcar`).
6. **Workflow (`site.yml`):** `workflow_dispatch` com input `publicacao` (main = produção, outro branch = preview); cron passa a diário `17 9 * * *` (06:17 em Brasília); reporta `rodando/ok/falhou` em `/api/build/status`; secrets `PAINEL_URL`, `BUILD_TOKEN` (produção) e `PAINEL_URL_PREVIEW`, `BUILD_TOKEN_PREVIEW` (preview). PR continua com check, testes, e2e e build offline.
7. **Importação inicial (`scripts/importa.ts`, roda uma vez por ambiente):** grava em D1 o contato, banner e cartões atuais (aba Produtos, sem "Contato para locação"), todos os pacotes da planilha com `chegou_em = data da importação` e `modo = auto`, e `catalogo = {fonte: "link", link: <planilha atual>}`. Sobe `ari-cantando.webp` para o R2 com `recortada: true`. Resultado: site idêntico ao de hoje; as 1.871 "novas" de hoje somem sozinhas após o prazo, a menos que o Ari marque.

## 8. Segurança

- Access protege `/admin*` e `/api/admin*` em produção **e** preview. Política: e-mails do Ari e do Gabriel.
- A Function confere o JWT `Cf-Access-Jwt-Assertion` (assinatura pelas chaves públicas do time `ACCESS_TEAM`, `aud` igual a `ACCESS_AUD` do ambiente, validade) e o e-mail em `ADMIN_EMAILS`. Sem isso: 401.
- Login de teste local: `DEV_ADMIN_EMAIL` em `.dev.vars`, aceito **só** se o host da requisição for `localhost`/`127.0.0.1`. Nunca configurado na Cloudflare.
- `BUILD_TOKEN`: 32+ bytes aleatórios, comparação em tempo constante.
- `GH_DISPATCH_TOKEN`: fine-grained, só este repositório, permissão `Actions: write` + `Contents: read`, validade 1 ano. Como renovar fica no README.
- Uploads: tamanho, assinatura (`PK` para xlsx, `RIFF…WEBP`, `FF D8 FF` ou `89 PNG` para foto), chave gerada no servidor.
- Textos do Ari sempre escapados (Astro já escapa; `catalogo.ts` usa `escapa`). Links montados a partir de campos validados.

## 9. Erros

| Caso | Site | Painel |
|---|---|---|
| Build falha | Fica a versão anterior | Falhou ❌ + motivo + Tentar de novo |
| Planilha do link não pública | Fica | "A planilha não está pública. Abra o compartilhamento no Google." |
| Arquivo com < 50% das músicas | Não publica | Confirmação extra na prévia |
| `.xlsx` sem aba "Músicas" ou sem coluna `codigo`/`titulo` | Nada muda | Erro na prévia, botão Confirmar bloqueado |
| Publicando > 10 min | Fica | "Está demorando. Avisa o Gabriel." |
| Checagem diária falha | Fica | E-mail do GitHub para o Gabriel |
| API fora do ar | **Continua no ar** | Painel mostra "Sem conexão com o servidor" |

## 10. Testes e verificação

- **Unit (vitest):** `classifica` (manual vence, prazo vencido, EXCLUSIVO, base); `.xlsx` da fixture == CSV da fixture após `montaMusicas`; validação de Zap/redes/limites; separação de palavras do banner.
- **API (vitest + `@cloudflare/vitest-pool-workers`, D1/R2 locais):** cada rota admin com e sem JWT; token de build; upload com assinatura errada; `pacotes` marcando chegada só na primeira vez.
- **E2E (Playwright + axe):** site — comanda vazia trava o botão, cartão com foto, banner vindo da config; painel (login de teste local) — editar contato, enviar `.xlsx` e ver prévia, trocar classificação de pacote, criar/reordenar cartão.
- **Prints:** site e painel em 375 / 768 / 1024 / 1440 px; antes/depois do cartão com foto e do banner.
- **Preview na Cloudflare** (D1/R2 de preview) testado de ponta a ponta antes de ir para `main`.
- Um comando para subir tudo local: `pnpm painel` (build offline + `wrangler pages dev` com D1/R2 locais + login de teste).

## 11. Configuração única (Gabriel, com passo a passo no README)

1. `wrangler d1 create` produção e preview; `wrangler r2 bucket create` produção e preview.
2. Zero Trust → Access → aplicação para `/admin*` e `/api/admin*` (produção e `*.ari-ribeiro-karaoke.pages.dev`), login por código no e-mail, política com os 2 e-mails.
3. GitHub → token fine-grained → secret `GH_DISPATCH_TOKEN` na Cloudflare.
4. Gerar `BUILD_TOKEN` → secret na Cloudflare e no GitHub; `PAINEL_URL` no GitHub.
5. Rodar `scripts/importa.ts` em preview e em produção.

## 12. Fora do escopo

Histórico/desfazer, vários usuários com permissões diferentes, editar o texto das mensagens do Zap, preço nos cartões, limpeza de arquivos antigos no R2, editar músicas individualmente no painel, SSR/revalidação.

## 13. Entrega

- **Fase 0** (branch `comanda-fixa`): botão do KJ travado com comanda vazia + teste e2e.
- **Fase 1** (branch nova `painel`): tudo o resto, em ordem: D1/R2 + API + testes → build lendo da API → painel → workflow → importação → preview → produção.
