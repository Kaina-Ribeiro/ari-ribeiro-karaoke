# Ari Ribeiro Karaokê

Catálogo de músicas do Ari Ribeiro Karaokê. O site é estático, gerado com [Astro](https://astro.build). O conteúdo é editado pelo próprio Ari em **`/admin`**: catálogo (planilha `.xlsx` ou link do Google Sheets), Novidades, banner, cartões de "Pra sua festa", WhatsApp e redes. Cada "Salvar" republica o site em uns 2 minutos.

O plano completo está em [`SPEC.md`](SPEC.md).

## Como funciona

```
Painel (/admin, protegido pelo Cloudflare Access)
   │  PUT /api/admin/...  → grava no D1 (config, cartões, pacotes) e no R2 (planilha, fotos)
   │  cria uma "publicação" e pede o build ao GitHub (workflow_dispatch, no branch do ambiente)
   ▼
GitHub Actions (.github/workflows/site.yml)
   │  scripts/planilha.ts: GET /api/build/config → lê o .xlsx do R2 ou a planilha do link
   │  POST /api/build/pacotes (marca a chegada dos pacotes novos) → gera os JSONs e baixa as fotos
   │  astro build → wrangler pages deploy → POST /api/build/status (o painel mostra "No ar ✅")
   ▼
Cloudflare Pages: dist/ (site estático) + functions/ (a API)
```

- **O site não depende da API.** Ele é gerado na publicação. Se a API cair, o site continua no ar; só o painel fica sem conexão.
- **A página vem pronta.** As 50 primeiras músicas, o banner e os cartões já estão no HTML, então a página aparece e é indexada antes do JavaScript rodar.
- **A busca roda no navegador.** O catálogo inteiro chega num JSON compacto e a busca leva poucos milissegundos, mesmo no celular. Ela procura por código, cantor, música e pelo começo da letra, sem ligar para acento e aceitando um erro de digitação.
- **Os nomes com hash** (`catalogo.3f2a….json`, `img/painel/5f44….webp`) deixam o navegador guardar os dados para sempre: quando algo muda, o nome muda junto.
- **Novidades automáticas.** Cada pacote ganha a data em que o build o viu pela primeira vez. Ele é "nova" durante o prazo do painel (padrão: 60 dias). O que o Ari escolhe à mão sempre vence.
- **Trava contra arquivo errado.** Um catálogo com menos da metade das músicas que estão no ar não é publicado, a não ser que o Ari confirme no painel.
- **Favoritas e comanda** ficam no `localStorage` do aparelho (`ari.favoritas` e `ari.comanda`). Não tem login para quem canta.

## Rodando local

Precisa de Node 22.18 ou mais novo e [pnpm](https://pnpm.io) (`corepack enable` já resolve).

```sh
pnpm install
pnpm painel             # tudo local: banco limpo + fixture + site + API + painel em http://localhost:8788
pnpm test               # vitest (inclui a API com D1/R2 locais do Miniflare)
pnpm check              # TypeScript
pnpm e2e                # navegador (Chrome, Android, iPhone e o painel) em cima do pnpm painel
pnpm prints             # prints do site e do painel em 375/768/1024/1440 px em prints/ (precisa do pnpm painel no ar)
pnpm prints:painel antes  # telas do painel + hover, toque e foco em prints/painel/antes/ (compare com outra pasta)
```

- **`pnpm painel`** recria o banco local em `.wrangler/painel` a cada vez, importa a fixture (`data/fixture/`), gera o site offline e sobe o `wrangler pages dev`. O painel fica em http://localhost:8788/admin. O login de teste vem do `DEV_ADMIN_EMAIL` do `.dev.vars` (criado a partir do `.dev.vars.example`) e só vale em `localhost`. Em dev, "Salvar" não chama o GitHub: a publicação aparece como feita ("simulado em dev").
- **Ver o site com o que você salvou no painel local:** com o `pnpm painel` no ar, rode `pnpm build:painel-local`. Ele usa `PAINEL_URL` e `BUILD_TOKEN` do `.dev.vars`.
- **Sem rede:** `pnpm build:offline` usa `data/fixture/config.json`, `data/fixture/*.csv` e `data/fixture/r2/`.
- `node scripts/fixture-xlsx.ts` regenera `data/fixture/musicas.xlsx` a partir do CSV.
- Na primeira vez, `pnpm exec playwright install chromium webkit` baixa os navegadores.

## Colunas da planilha

Vale para o `.xlsx` enviado e para o link do Google. Só a aba **Músicas** é lida: `codigo`, `cantor`, `titulo`, `trecho`, `pacote`, `duplicado`.

- Linhas com `duplicado` verdadeiro, sem código ou sem título ficam de fora.
- Se um código aparece duas vezes, vale a primeira linha.
- `pacote` vazio ou "Ari Ribeiro karaoke" é o catálogo base. Qualquer pacote com "EXCLUSIVO" vira **só no Ari**. Os outros são **nova** durante o prazo, contado da chegada.
- O mesmo cantor escrito de jeitos diferentes ("5 Seconds Of Summer" e "5 Seconds of Summer", "Guns N Roses" e "Guns n´ Roses") é unificado na grafia mais usada.
- Cantor de várias palavras todo em MAIÚSCULAS vira "Alice in Chains". Nome de uma palavra (BTS, ABBA) e siglas (MC, DJ, CPM 22) ficam como estão.
- `trecho` igual a "0" ou igual ao pacote ("COM VOCAIS") é tratado como sem letra.
- No `.xlsx`, o código é lido como aparece na célula: "00550" continua "00550".

A planilha do link precisa estar como **"qualquer pessoa com o link pode ver"**. O site nunca escreve nela.

## Publicação

O workflow `.github/workflows/site.yml`:

- **Em todo PR:** roda check, testes, e2e e o build offline. Não publica nem avisa o painel.
- **Em todo push na `main`:** testa e publica com os dados do painel.
- **Quando o Ari salva no painel** (`workflow_dispatch` com o id da publicação): gera e publica, avisando o painel em cada etapa. O painel de produção pede no `main` (deploy de produção); o de preview pede no branch `painel` (deploy de preview, com os secrets `*_PREVIEW`).
- **Todo dia às 06:17 (Brasília):** lê a planilha de novo e publica somente se algo mudou (compara com o `versao.txt` que está no ar).

O deploy usa upload direto (wrangler) em vez da integração Git da Cloudflare. A integração tem limite de builds por mês e não deixaria o painel disparar a publicação.

## Configuração única

Faça na ordem. Primeiro em **preview**, para testar, e depois em **produção**.

### 1. Banco (D1) e arquivos (R2)

O D1 guarda o que o Ari edita. O R2 guarda a planilha enviada e as fotos.

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create ari-painel-preview
pnpm exec wrangler d1 create ari-painel
pnpm exec wrangler r2 bucket create ari-arquivos-preview
pnpm exec wrangler r2 bucket create ari-arquivos
```

Cada `d1 create` mostra um `database_id`. Cole o de preview em `[[env.preview.d1_databases]]` e o de produção em `[[d1_databases]]` no `wrangler.toml`.

### 2. Login do painel (Cloudflare Access)

O Access é a porta: só entra quem recebe um código de 6 dígitos no e-mail cadastrado. É grátis até 50 pessoas.

1. No painel da Cloudflare, abra **Zero Trust**. Na primeira vez, ele pede um nome de time (por exemplo `ariribeiro`). Esse nome é o `ACCESS_TEAM`.
2. **Access → Applications → Add an application → Self-hosted.**
3. Nome: `Painel do Ari`. Em *Public hostname*, adicione:
   - `ari-ribeiro-karaoke.pages.dev`, caminho `admin`
   - `ari-ribeiro-karaoke.pages.dev`, caminho `api/admin`
   - `*.ari-ribeiro-karaoke.pages.dev`, caminho `admin` (preview)
   - `*.ari-ribeiro-karaoke.pages.dev`, caminho `api/admin` (preview)
4. Em *Login methods*, deixe só **One-time PIN** (código no e-mail).
5. Crie uma *Policy* "Ari e Gabriel" com a ação **Allow**. Em *Include*, escolha *Emails* e coloque os dois e-mails.
6. Salve e abra a aplicação. Em **Overview**, copie o **Application Audience (AUD) Tag**. Esse é o `ACCESS_AUD`.
7. No `wrangler.toml`, preencha `ACCESS_TEAM` e `ACCESS_AUD`, em `[vars]` e em `[env.preview.vars]`.
8. Os e-mails **não** vão no `wrangler.toml`: o repositório é público. Eles viram o segredo `ADMIN_EMAILS` (os mesmos e-mails da política, separados por vírgula). Em produção, use `pnpm exec wrangler pages secret put ADMIN_EMAILS --project-name ari-ribeiro-karaoke`. No preview, crie pelo navegador, como os outros segredos (passo 3).

A API confere de novo o login: a assinatura, o AUD e se o e-mail está em `ADMIN_EMAILS`. Assim, mesmo um Access mal configurado não abre o painel.

### 3. Token do GitHub (para o painel pedir a publicação)

1. GitHub → foto → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.**
2. Nome `painel-ari`, validade **1 ano**, *Repository access*: só `Kaina-Ribeiro/ari-ribeiro-karaoke`.
3. *Permissions → Repository*: **Actions: Read and write** e **Contents: Read-only**.
4. Gere e copie. Depois guarde na Cloudflare (o comando pede o valor):

```sh
pnpm exec wrangler pages secret put GH_DISPATCH_TOKEN --project-name ari-ribeiro-karaoke
```

O comando grava o segredo de **produção**. Para o **preview**, crie o mesmo segredo pelo navegador: *Workers & Pages → ari-ribeiro-karaoke → Settings → Variables and Secrets*, escolhendo o ambiente *Preview*. Vale também para o `BUILD_TOKEN` (passo 4); no preview, use o valor do `BUILD_TOKEN_PREVIEW`.

**Para renovar** (o GitHub avisa por e-mail antes de vencer): gere um novo com as mesmas permissões e rode o comando de novo. Enquanto o token estiver vencido, o painel mostra "Falhou ❌ … (HTTP 401)" e o site continua como estava.

### 4. Token do build

É a senha que o GitHub Actions usa para ler a config do painel.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
pnpm exec wrangler pages secret put BUILD_TOKEN --project-name ari-ribeiro-karaoke
```

No GitHub, em **Settings → Secrets and variables → Actions**, crie:

- `BUILD_TOKEN`: o mesmo valor.
- `PAINEL_URL`: `https://ari-ribeiro-karaoke.pages.dev` (ou o domínio próprio).
- `BUILD_TOKEN_PREVIEW` e `PAINEL_URL_PREVIEW` (`https://painel.ari-ribeiro-karaoke.pages.dev`): os mesmos dois para o preview. Use um token diferente do de produção.

O preview só publica depois que o branch `painel` estiver no GitHub: é nele que o painel de preview pede o build.

Os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` continuam os de antes. O token vem de *My Profile → API Tokens*, com permissão *Account → Cloudflare Pages → Edit*. O Account ID aparece na lateral de *Workers & Pages*.

### 5. Importação inicial

Grava no D1 o site de hoje: contato, banner, cartões da aba Produtos e pacotes da aba Músicas, com chegada na data da importação. Também sobe a foto do Ari para o R2. Rodar de novo não duplica nem apaga o que o Ari mudou.

```sh
node scripts/importa.ts --alvo preview
node scripts/importa.ts --alvo producao
```

Os dois comandos pedem confirmação antes de gravar.

> O GitHub pausa workflows agendados em repositórios sem commits há 60 dias. Se a checagem diária parar, reative em Actions → Site → Enable workflow.

## Estrutura

```
api/                    a API (rotas, login, publicações), chamada por functions/api/[[rota]].ts
functions/              Pages Functions (só a porta de entrada da API)
migrations/             tabelas do D1
scripts/planilha.ts     build dos dados: config do painel + catálogo → JSONs e fotos
scripts/importa.ts      importação inicial (local, preview, produção)
scripts/status.ts       avisa o painel em cada etapa do workflow
scripts/painel-local.ts pnpm painel
src/lib/                código dividido entre build, navegador e API (CSV, .xlsx, busca, texto, validação)
src/lib/painel/         regras do painel: classificação de pacote, validação, cartaz
src/scripts/            código do navegador: catálogo, letreiro, painel
src/pages/index.astro   o site
src/pages/admin/        o painel e a prévia do banner
src/styles/             visual do site (global.css) e do painel (painel.css)
public/_headers         cache e segurança na Cloudflare
data/fixture/           pedaço da planilha e config de exemplo, para rodar offline e nos testes
test/                   testes (vitest); test/api/ roda a API com D1/R2 locais
e2e/                    testes no navegador (Playwright + axe)
```
