# Ari Ribeiro Karaokê

Catálogo de músicas do Ari Ribeiro Karaokê. O site é estático, gerado com [Astro](https://astro.build) a partir da planilha do Google onde o Ari mantém as músicas. Para mudar o catálogo, basta editar a planilha: o site se atualiza sozinho em até uma hora.

## Como funciona

```
Planilha (Google Sheets)
   │  scripts/planilha.ts baixa as abas "Músicas" e "Produtos" em CSV
   ▼
public/data/catalogo.<hash>.json   código, cantor, música, pacote   (~110 kB gzip)
public/data/letras.<hash>.json     coluna "trecho"                  (~110 kB gzip)
src/data/gerado/manifesto.json     nomes dos arquivos, 50 primeiras músicas, serviços
   │  astro build
   ▼
dist/  →  Cloudflare Pages
```

- **A página vem pronta.** As 50 primeiras músicas e os serviços já estão no HTML, então a página aparece e é indexada antes do JavaScript rodar.
- **A busca roda no navegador.** O catálogo inteiro chega num JSON compacto e a busca leva poucos milissegundos, mesmo no celular. Ela procura por código, cantor, música e pelo começo da letra, sem ligar para acento e aceitando um erro de digitação.
- **Os nomes com hash** (`catalogo.3f2a….json`) deixam o navegador guardar os dados para sempre: quando a planilha muda, o nome muda junto.
- **Favoritas e comanda** ficam no `localStorage` do aparelho (`ari.favoritas` e `ari.comanda`). Não tem login. Se a pessoa limpar os dados do navegador ou trocar de celular, perde a lista.

## Rodando local

Precisa de Node 22.18 ou mais novo.

```sh
npm install
npm run build            # baixa a planilha e gera o site em dist/
npm run preview          # serve o dist/ em http://localhost:4321

npm run build:offline    # usa data/fixture/*.csv em vez da planilha
npm run planilha         # só baixa a planilha (rode antes do `npm run dev`)
npm run dev
npm test
npm run check            # TypeScript
```

A planilha precisa estar como **"qualquer pessoa com o link pode ver"**. Para usar outra, defina `SHEET_ID`.

## Colunas da planilha

**Músicas:** `codigo`, `cantor`, `titulo`, `trecho`, `pacote`, `duplicado`.

- Linhas com `duplicado` verdadeiro, sem código ou sem título ficam de fora.
- Se um código aparece duas vezes, vale a primeira linha.
- `pacote` vazio ou "Ari Ribeiro karaoke" é o catálogo base. Qualquer pacote com "EXCLUSIVO" vira **só no Ari**, e o resto vira **nova**.
- O mesmo cantor escrito de jeitos diferentes ("5 Seconds Of Summer" e "5 Seconds of Summer") é unificado na grafia mais usada.

**Produtos:** `ativo` (S/N), `titulo`, `destaque`, `descricao`. São os cartões de "Pra sua festa".

## Deploy

O workflow `.github/workflows/site.yml`:

- **Em todo PR:** roda check, testes e build com a planilha de verdade.
- **Em todo push na `main`:** publica na Cloudflare Pages.
- **De hora em hora:** baixa a planilha e publica somente se os dados mudaram. Para isso, compara com o `versao.txt` que está no ar.

O deploy usa upload direto (wrangler) em vez da integração Git da Cloudflare. Os builds da Cloudflare são limitados a 500 por mês, e o rebuild de hora em hora passaria disso.

### Configurar uma vez

1. Na Cloudflare, abra **My Profile → API Tokens → Create Token**, use o modelo *Edit Cloudflare Workers* (ou crie um token com a permissão *Account → Cloudflare Pages → Edit*) e copie o token.
2. Copie o **Account ID**, que aparece na lateral do painel em *Workers & Pages*.
3. No GitHub, em **Settings → Secrets and variables → Actions**, crie os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
4. Rode o workflow **Site** manualmente (Actions → Site → Run workflow). Ele cria o projeto `ari-ribeiro-karaoke` na primeira vez.
5. Quando tiver domínio próprio, adicione o domínio em *Workers & Pages → ari-ribeiro-karaoke → Custom domains* e crie a variável `SITE_URL` (Actions → Variables) com o endereço novo.

> O GitHub pausa workflows agendados em repositórios sem commits há 60 dias. Se o site parar de atualizar, reative em Actions → Site → Enable workflow.

## Estrutura

```
scripts/planilha.ts     baixa a planilha e gera os JSONs
src/lib/                código compartilhado entre build e navegador (CSV, busca, texto)
src/scripts/            código do navegador (catálogo, letreiro animado)
src/pages/index.astro   a página
src/styles/global.css   todo o visual
public/_headers         cache da Cloudflare
data/fixture/           pedaço da planilha para rodar offline e nos testes
test/                   testes (vitest)
```
