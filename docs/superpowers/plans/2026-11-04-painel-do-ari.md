# Painel do Ari · Plano de implementação (Fase 1)

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** o Ari edita catálogo, Novidades, banner, cartões de festa e contatos em `/admin`, e cada "Salvar" republica o site estático.

**Arquitetura:** a lógica da API fica em `api/` como funções puras `(Request, Env, Deps) → Response`, chamadas por um único `functions/api/[[rota]].ts` (Pages Functions). Regras de negócio que o navegador, o build e o Worker dividem ficam em `src/lib/painel/`. O build (`scripts/planilha.ts`) passa a ler a config da API (ou de `data/fixture/config.json` no modo offline) e continua gerando os mesmos JSONs de hoje.

**Stack:** Astro 7 estático · Cloudflare Pages Functions + D1 + R2 · `jose` · SheetJS `xlsx` 0.20.3 · vitest 5 + Miniflare (D1/R2 locais) · Playwright + axe · wrangler 4.

**Spec:** [`SPEC.md`](../../../SPEC.md) (aprovado). Decisões D1–D11 e "Fora do escopo" não se reabrem.

## Restrições globais

- Node `>=22.18`, pnpm 10, Astro com `output: "static"` (sem SSR).
- SheetJS só pelo tarball oficial: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Nunca roda no Worker (D10).
- Versões de dependência novas ficam **fixas** (sem `^`), como o resto do `package.json`.
- Código da API importa tipos de `@cloudflare/workers-types` por `import type`, nunca como global (senão briga com o DOM do Astro no `pnpm check`).
- Limites: linha da frase grande ≤ **14**; frase de baixo ≤ 80; legenda ≤ 16 e ≤ 30; cartão: título ≤ 40, destaque ≤ 30, descrição ≤ 160; `.xlsx` ≤ 10 MB; foto ≤ 2 MB. Contagem por caractere visível (`[...s].length`).
- Zap guardado como `55DDNNNNNNNNN` (13 dígitos), mostrado como `(12) 99116-7274`.
- Chaves R2 só geradas no servidor: `planilhas/<AAAA-MM-DD>-<aleatório>.xlsx`, `fotos/<aleatório>.webp`.
- "Hoje" é sempre a data de `America/Sao_Paulo` (`AAAA-MM-DD`).
- Erros da API: `{erro: "mensagem em português"}` + status HTTP. Textos de tela em pt-BR.
- Planilha do Google: **só leitura**. Nada de push, PR ou configuração na Cloudflare/GitHub sem perguntar ao Gabriel.
- Visual do site não muda (D11), exceto cartão de festa com foto.

## Foco da revisão

1. **Código com zero à esquerda no `.xlsx`** ("00550" salvo como número com formato `00000`) precisa sair "00550", igual ao CSV. → teste na Tarefa 9.
2. **Mesmo pacote com grafia diferente** ("13K ", "13k") é um pacote só e não ganha nova data de chegada. → teste na Tarefa 8.
3. **Zap colado de qualquer jeito** ("+55 (12) 99116-7274", "12991167274", "012 99116 7274") vira `5512991167274`; fixo de 8 dígitos é recusado com mensagem clara. → teste na Tarefa 3.
4. **Publicações fora de ordem:** run antiga cancelada ou atrasada não pode tirar o painel de "No ar ✅" depois que uma mais nova terminou `ok`. → teste na Tarefa 5.
5. **Login de teste vazando para a nuvem:** `DEV_ADMIN_EMAIL` configurado e requisição para `*.pages.dev` sem JWT → 401. → teste na Tarefa 4.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `wrangler.toml` | Bindings `DB`/`ARQUIVOS`, vars, ambiente `preview` |
| `migrations/0001_inicial.sql` | Tabelas do SPEC §4 |
| `functions/api/[[rota]].ts` | Só repassa para `handle` |
| `api/app.ts` | Roteador + `handle(req, env, deps?)` |
| `api/tipos.ts` | `Env`, `Deps` |
| `api/resposta.ts` | `json()`, `erro()` |
| `api/auth.ts` | Admin (Access/JWT/dev), build (token), origem |
| `api/publicacoes.ts` | Criar, disparar GitHub, registrar status |
| `api/config.ts` | Ler/gravar `config`, cartões, pacotes no D1 |
| `api/rotas/admin.ts`, `api/rotas/build.ts`, `api/rotas/arquivos.ts` | Rotas |
| `src/lib/painel/tipos.ts` | Tipos da config compartilhados |
| `src/lib/painel/padrao.ts` | `CONFIG_PADRAO` (valores do site de hoje) |
| `src/lib/painel/classifica.ts` | `classifica`, `chavePacote`, `hojeSP` |
| `src/lib/painel/valida.ts` | Validação de contato, banner, cartão, novidades, link |
| `src/lib/painel/cartaz.ts` | Letreiro, legenda, negrito → HTML (site e prévia) |
| `src/lib/xlsx.ts` | Lê aba "Músicas" com SheetJS + prévia |
| `src/lib/build.ts` | Manifesto, trava de 50% |
| `scripts/painel.ts` | Cliente HTTP da API de build |
| `scripts/planilha.ts` | Build de dados (reescrito) |
| `scripts/status.ts` | Reporta status do Actions para a API |
| `scripts/importa.ts`, `scripts/importa-sql.ts` | Importação inicial |
| `scripts/painel-local.ts` | `pnpm painel` |
| `scripts/prints.ts` | Prints 375/768/1024/1440 e antes/depois |
| `src/pages/admin/index.astro`, `src/pages/admin/previa.astro` | Painel e prévia do banner |
| `src/scripts/painel/*.ts`, `src/styles/painel.css` | Telas do painel |
| `test/api/ambiente.ts` | Miniflare com D1/R2 + JWT de teste |

---

### Tarefa 1: Fundação (dependências, D1, roteador, ambiente de teste)

**Arquivos:**
- Modificar: `package.json`, `.gitignore`, `tsconfig.json` (se preciso incluir `api/`, `functions/`)
- Criar: `wrangler.toml`, `migrations/0001_inicial.sql`, `api/tipos.ts`, `api/resposta.ts`, `api/app.ts`, `functions/api/[[rota]].ts`, `.dev.vars.example`, `test/api/ambiente.ts`, `test/api/base.test.ts`

**Interfaces:**
- Produz:
  - `interface Env { DB: D1Database; ARQUIVOS: R2Bucket; ADMIN_EMAILS: string; ACCESS_TEAM?: string; ACCESS_AUD?: string; DEV_ADMIN_EMAIL?: string; BUILD_TOKEN: string; GH_DISPATCH_TOKEN?: string; GH_REPO?: string }` (`GH_REPO` padrão `"Kaina-Ribeiro/ari-ribeiro-karaoke"`)
  - `interface Deps { chaves(env: Env): JWTVerifyGetKey; agora(): Date; fetch: typeof fetch; aleatorio(): string }` e `depsPadrao`
  - `handle(req: Request, env: Env, deps?: Partial<Deps>): Promise<Response>`
  - `rota(metodo, padrao, fn)` com padrões `"/api/admin/cartoes/:id"` e curinga `":chave*"` (casa com `/`)
  - `json(dados: unknown, status = 200): Response`, `erro(mensagem: string, status: number): Response`
  - `criaAmbiente(opcoes?: { env?: Partial<Env> }): Promise<{ env: Env; chamar(req: Request, deps?: Partial<Deps>): Promise<Response>; fecha(): Promise<void> }>` — Miniflare com D1 e R2 em memória, migração aplicada

- [ ] **Passo 1:** instalar dependências com versão fixa: `jose`, `xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (dependencies); `wrangler@4`, `miniflare@4`, `@cloudflare/workers-types` (devDependencies). Conferir `pnpm-lock.yaml` atualizado.
- [ ] **Passo 2:** `wrangler.toml` com `name = "ari-ribeiro-karaoke"`, `pages_build_output_dir = "dist"`, `compatibility_date = "2026-10-01"`, `[[d1_databases]] binding="DB" database_name="ari-painel" migrations_dir="migrations"`, `[[r2_buckets]] binding="ARQUIVOS" bucket_name="ari-arquivos"`, `[vars] ADMIN_EMAILS`, `ACCESS_TEAM`, `ACCESS_AUD`, e `[env.preview]` com `ari-painel-preview` / `ari-arquivos-preview`. IDs do D1 = `00000000-0000-0000-0000-000000000000` com comentário "preencher na Tarefa 20". E-mails/AUD ficam vazios até lá.
- [ ] **Passo 3:** `migrations/0001_inicial.sql` = SQL exato do SPEC §4 + `CREATE INDEX publicacoes_status ON publicacoes(status, id);`.
- [ ] **Passo 4:** `.gitignore` ganha `.dev.vars`, `.wrangler/`, `public/img/painel/`, `prints/`, `.erro-build.txt`. `.dev.vars.example` com `DEV_ADMIN_EMAIL=gabriel@painel.test`, `ADMIN_EMAILS=gabriel@painel.test`, `BUILD_TOKEN=` (64 hex gerados na hora, só local).
- [ ] **Passo 5: teste que falha** (`test/api/base.test.ts`):
  - `GET /api/nada` → 404, `{erro: "Rota não encontrada"}`
  - as 4 tabelas existem (`SELECT name FROM sqlite_master WHERE type='table'` contém `config`, `cartoes`, `pacotes`, `publicacoes`)
  - `POST /api/build/config` (método errado) → 405
- [ ] **Passo 6:** rodar `pnpm vitest run test/api/base.test.ts` → FALHA (módulo não existe).
- [ ] **Passo 7:** implementar `api/*`, `functions/api/[[rota]].ts` (`export const onRequest: PagesFunction<Env> = (c) => handle(c.request, c.env)`) e `test/api/ambiente.ts` (aplica a migração com `db.batch` das instruções separadas por `;`).
- [ ] **Passo 8:** `pnpm vitest run test/api/base.test.ts` → PASSA. `pnpm check` → sem erro.
- [ ] **Passo 9:** commit `feat(api): fundação D1/R2, roteador e ambiente de teste`.

### Tarefa 2: Classificação de pacote e data de hoje

**Arquivos:** Criar `src/lib/painel/classifica.ts`, `src/lib/painel/tipos.ts`, `test/classifica.test.ts`

**Interfaces:**
- Produz:
  - `type Modo = "auto" | "nova" | "exc" | "base"`
  - `interface PacoteDb { chave: string; nome: string; chegouEm: string; musicas: number; vistoEm: string; modo: Modo }`
  - `chavePacote(nome: string): string` — `nome.trim().toUpperCase()` com espaços internos colapsados
  - `hojeSP(agora: Date): string` — `AAAA-MM-DD` em `America/Sao_Paulo`
  - `classifica(p: { nome: string; chegouEm: string; modo: Modo }, prazoDias: number, hoje: string): Pacote` — algoritmo exato do SPEC §4
  - `diasEntre(de: string, ate: string): number`

- [ ] **Passo 1: testes que falham**, cada um com `hoje = "2026-11-04"`, prazo 60:
  - `modo: "base"` num pacote que chegou hoje → `"base"` (manual vence)
  - `modo: "nova"` com chegada em 2020 → `"nova"`
  - nome `""` e `"Ari Ribeiro karaoke "` com `auto` → `"base"`
  - `"ARI EXCLUSIVO"` chegou hoje → `"exc"`
  - `"13K"` chegou `2026-10-01` (34 dias) → `"nova"`; chegou `2026-09-05` (60 dias) → `"base"`
  - `chavePacote(" 13k  ")` === `chavePacote("13K")` === `"13K"`
  - `hojeSP(new Date("2026-11-05T02:30:00Z"))` → `"2026-11-04"` (ainda é dia 4 em Brasília)
- [ ] **Passo 2:** `pnpm vitest run test/classifica.test.ts` → FALHA.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** → PASSA.
- [ ] **Passo 5:** commit `feat: classificação de pacote por data de chegada`.

### Tarefa 3: Validação e textos do banner

**Arquivos:** Criar `src/lib/painel/valida.ts`, `src/lib/painel/cartaz.ts`, `src/lib/painel/padrao.ts`; completar `src/lib/painel/tipos.ts`; testes `test/valida.test.ts`, `test/cartaz.test.ts`

**Interfaces:**
- Produz (em `tipos.ts`):
  - `interface Contato { zapContato: string; zapKj: string | null; instagram: string; facebook: string | null }`
  - `interface Banner { linhas: [string, string, string]; frase: string; legenda: [string, string]; foto: { chave: string; recortada: boolean } }`
  - `interface FonteCatalogo { fonte: "arquivo" | "link"; link: string | null; arquivo: { chave: string; nome: string; enviadoEm: string; musicas: number; pacotes: number; forcar?: boolean } | null }`
  - `interface Novidades { prazoDias: number }`
  - `interface Cartao { id: number; ordem: number; ativo: boolean; titulo: string; destaque: string; descricao: string; fotoChave: string | null }`
  - `type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string }`
- Produz (em `valida.ts`): `normalizaZap(s): Resultado<string>`, `formataZap(z: string): string`, `normalizaUsuario(s): Resultado<string>`, `validaContato(x: unknown): Resultado<Contato>`, `validaBanner(x: unknown): Resultado<Omit<Banner,"foto"> & { foto: Banner["foto"] }>`, `validaCartao(x: unknown): Resultado<Omit<Cartao,"id"|"ordem">>`, `validaNovidades(x: unknown): Resultado<Novidades>` (inteiro 1–365), `idDaPlanilha(url: string): string | null`
- Produz (em `cartaz.ts`):
  - `type Palavra = { texto: string; classe: "" | "serif" | "ouro" }`
  - `letreiro(linhas: string[]): Palavra[][]` — linhas vazias saem; na **última** linha, as palavras antes da última viram **uma** `Palavra` `serif` e a última vira `ouro`; nas outras, uma `Palavra` por palavra. (Assim o HTML fica idêntico ao de hoje.)
  - `rotuloLetreiro(linhas: string[]): string` — juntas por espaço, sem pontuação final (`"Solta a voz, o palco é seu"`)
  - `quebraNoMeio(s: string): [string, string]` — quebra no espaço mais perto do meio
  - `negrito(s: string): { texto: string; forte: boolean }[]` — `*palavra*` vira forte
  - `htmlLetreiro(linhas)`, `htmlPoster(banner, fotoSrc)` — strings HTML com `escapa`, mesmas classes de hoje
- Produz (em `padrao.ts`): `CONFIG_PADRAO: { contato: Contato; banner: Banner; catalogo: FonteCatalogo; novidades: Novidades }` com os valores do site de hoje: zap `5512991167274`, instagram `ariribeirokaraoke`, linhas `["Solta", "a voz,", "o palco é seu."]`, frase `"Acha a música, anota o *código* e manda pro KJ."`, legenda `["Com Ari Ribeiro", "aqui a diversão é garantida"]`, foto `{chave: "fotos/ari-cantando.webp", recortada: true}`, link da planilha `1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx`, prazo 60.

- [ ] **Passo 1: testes que falham** (`valida.test.ts`):
  - `normalizaZap` de `"+55 (12) 99116-7274"`, `"12991167274"`, `"012 99116 7274"`, `"5512991167274"` → `ok, "5512991167274"`
  - `"1233334444"` (fixo) → erro `"Use um celular com DDD: (12) 99999-9999"`; `"00991167274"` (DDD 00) → erro
  - `formataZap("5512991167274")` → `"(12) 99116-7274"`
  - `normalizaUsuario` de `"@ariribeirokaraoke"`, `"https://www.instagram.com/ariribeirokaraoke/"` → `"ariribeirokaraoke"`; `"ari ribeiro"` → erro
  - `validaContato` com `zapKj: ""` → `zapKj: null`; sem `zapContato` → erro
  - banner: linha 1 com 15 caracteres → erro `"A linha 1 pode ter até 14 letras"`; `"Ação já é nossa"` (14) passa; linha 1 vazia → erro; frase vazia → erro; legenda com 17 → erro
  - cartão: título com 41 → erro; descrição vazia → erro
  - `idDaPlanilha("https://docs.google.com/spreadsheets/d/1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx/edit#gid=0")` → o id; `"https://evil.com/spreadsheets/d/x"` → `null`; `"http://docs.google.com.evil.com/spreadsheets/d/x"` → `null`
- [ ] **Passo 2: testes que falham** (`cartaz.test.ts`):
  - `letreiro(CONFIG_PADRAO.banner.linhas)` → `[[{texto:"Solta",classe:""}], [{"a",""},{"voz,",""}], [{texto:"o palco é",classe:"serif"},{texto:"seu.",classe:"ouro"}]]`
  - `letreiro(["Canta", "", ""])` → `[[{texto:"Canta",classe:"ouro"}]]`
  - `htmlLetreiro(CONFIG_PADRAO.banner.linhas)` é igual ao HTML das 3 `<span class="l">` de `src/pages/index.astro` hoje (copiar o trecho para o teste)
  - `quebraNoMeio("Com Ari Ribeiro")` → `["Com Ari", "Ribeiro"]`; `quebraNoMeio("aqui a diversão é garantida")` → `["aqui a diversão", "é garantida"]`
  - `negrito("anota o *código* e")` → 3 trechos, o do meio forte
  - `htmlLetreiro(["<b>"])` contém `&lt;b&gt;`
- [ ] **Passo 3:** rodar os dois → FALHAM. **Passo 4:** implementar. **Passo 5:** → PASSAM.
- [ ] **Passo 6:** commit `feat: validação dos campos do painel e montagem do letreiro`.

### Tarefa 4: Autenticação

**Arquivos:** Criar `api/auth.ts`, `test/api/auth.test.ts`; modificar `api/app.ts`, `test/api/ambiente.ts` (gera par de chaves e assina JWT de teste)

**Interfaces:**
- Consome: `Env`, `Deps`, `erro()`
- Produz:
  - `exigeAdmin(req, env, deps): Promise<{ email: string } | Response>`
  - `exigeBuild(req, env): true | Response` — `Bearer`, comparação em tempo constante (XOR de bytes, mesmo tamanho)
  - `confereOrigem(req): true | Response` — mutações (`POST/PUT/DELETE`) exigem `Origin` igual à origem de `req.url` e `Content-Type` `application/json` ou `multipart/form-data`
  - Em `ambiente.ts`: `jwtDeTeste(email: string, opcoes?: { aud?: string; expirado?: boolean }): Promise<string>` e `deps.chaves` apontando para `createLocalJWKSet`

Regras de `exigeAdmin`: se `hostname` de `req.url` for `localhost` ou `127.0.0.1` **e** `DEV_ADMIN_EMAIL` existir → admin com esse e-mail. Senão, JWT em `Cf-Access-Jwt-Assertion`, `jwtVerify` com `issuer: https://<ACCESS_TEAM>.cloudflareaccess.com`, `audience: ACCESS_AUD`, e `email` (minúsculo) em `ADMIN_EMAILS` (lista separada por vírgula). Falha → 401 `{erro: "Faça login de novo."}`. `depsPadrao.chaves` usa `createRemoteJWKSet(<issuer>/cdn-cgi/access/certs)` memoizado.

- [ ] **Passo 1: testes que falham** (rota alvo: `GET /api/admin/estado`, que por ora devolve `{}`; e `GET /api/build/config`, que por ora devolve `{}`):
  - sem JWT em `https://ari.pages.dev` → 401
  - JWT válido, e-mail na lista → 200; e-mail fora da lista → 401; `aud` errado → 401; expirado → 401
  - `DEV_ADMIN_EMAIL` definido + `http://localhost:8788` sem JWT → 200
  - `DEV_ADMIN_EMAIL` definido + `https://abc.ari-ribeiro-karaoke.pages.dev` sem JWT → **401** (Foco 5)
  - `PUT /api/admin/contato` com JWT válido e `Origin: https://evil.com` → 403; sem `Content-Type` JSON → 415
  - build: sem token → 401; token errado do mesmo tamanho → 401; token certo → 200
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** commit `feat(api): login pelo Cloudflare Access e token do build`.

### Tarefa 5: Publicações (GitHub, status, substituídas)

**Arquivos:** Criar `api/publicacoes.ts`, `test/api/publicacoes.test.ts`; modificar `api/app.ts` (rotas `POST /api/admin/publicar`, `POST /api/build/status`)

**Interfaces:**
- Produz:
  - `interface Publicacao { id: number; motivo: string; status: "pendente"|"rodando"|"ok"|"falhou"; erro: string|null; runUrl: string|null; musicas: number|null; pedidoEm: string; terminouEm: string|null }`
  - `criaPublicacao(env, deps, motivo: string): Promise<Publicacao>` — grava `pendente` e chama `disparaBuild`
  - `disparaBuild(env, deps, id: number): Promise<void>` — sem `GH_DISPATCH_TOKEN`: vira `ok` com `erro: "simulado em dev"`. Com token: `POST https://api.github.com/repos/<GH_REPO>/dispatches`, `{event_type: "publicar", client_payload: {publicacao: id}}`, headers `Authorization: Bearer`, `Accept: application/vnd.github+json`, `User-Agent: ari-painel`. Resposta não-2xx → `falhou` com `"Não consegui pedir a publicação ao GitHub (HTTP <n>)."`
  - `registraStatus(env, deps, corpo): Promise<{ publicacao: number; ignorada?: true }>`
  - `ultimaPublicacao(env): Promise<Publicacao|null>`, `musicasNoAr(env): Promise<number|null>` (última `ok` com `musicas` não nulo)

Regras de `registraStatus`: `status` fora de `rodando|ok|falhou` → 400. Sem `publicacao` → cria com motivo `"diaria"` já no status recebido. Publicação já `ok`/`falhou` → não muda, devolve `ignorada: true`. `ok` → `terminou_em`, `musicas`, todas as anteriores (`id <`) em `pendente`/`rodando` viram `ok`, e apaga `catalogo.arquivo.forcar`. `falhou` → `erro` (máx. 500 caracteres), `terminou_em`.

- [ ] **Passo 1: testes que falham:**
  - `POST /api/admin/publicar` sem token do GitHub → 200, publicação `ok`, `erro: "simulado em dev"`
  - com token e `fetch` falso devolvendo 204 → `pendente`; o corpo enviado tem `event_type: "publicar"` e o id
  - `fetch` falso devolvendo 401 → `falhou`, mensagem com "HTTP 401"
  - status sem `publicacao` → cria `"diaria"` e devolve o id
  - pubs 1 e 2 `pendente`; status `ok` na 2 → a 1 também `ok`; depois `falhou` na 1 → `ignorada`, continua `ok` (Foco 4)
  - `ok` com `musicas: 12000` → `musicasNoAr` = 12000
  - config `catalogo.arquivo.forcar = true`; status `ok` → `forcar` some
  - status `"xyz"` → 400
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** commit `feat(api): publicações disparando o GitHub Actions`.

### Tarefa 6: Rotas de configuração (estado, contato, banner, catálogo, novidades)

**Arquivos:** Criar `api/config.ts`, `api/rotas/admin.ts`, `test/api/admin.test.ts`

**Interfaces:**
- Consome: `validaContato`, `validaBanner`, `validaNovidades`, `idDaPlanilha`, `CONFIG_PADRAO`, `classifica`, `hojeSP`, `criaPublicacao`
- Produz:
  - `leConfig<K extends keyof typeof CONFIG_PADRAO>(env, chave: K): Promise<(typeof CONFIG_PADRAO)[K]>` (cai no padrão se não houver linha)
  - `gravaConfig(env, chave, valor, agora): Promise<void>`
  - `GET /api/admin/estado` → `{ contato, banner, catalogo, novidades, cartoes: Cartao[], pacotes: (PacoteDb & { classe: Pacote })[], publicacao: Publicacao|null, musicasNoAr: number|null, hoje: string }`
  - `PUT /api/admin/{contato|banner|catalogo|novidades}` → `{ ok: true, publicacao: Publicacao }`; motivo = nome da rota

Regras: banner exige que `foto.chave` exista no R2 (`ARQUIVOS.head`) e comece com `fotos/`. Catálogo `fonte: "link"` exige `idDaPlanilha(link)`; guarda o link normalizado `https://docs.google.com/spreadsheets/d/<id>`. `fonte: "arquivo"` exige chave `planilhas/...` existente no R2; `enviadoEm` vem do servidor.

- [ ] **Passo 1: testes que falham:**
  - `estado` num banco vazio devolve `CONFIG_PADRAO` e `publicacao: null`
  - `PUT contato` com `"+55 (12) 98888-7777"` → 200; `estado` mostra `5512988887777`; existe 1 publicação `"contato"`
  - `PUT contato` inválido → 400 com a mensagem da validação e **nenhuma** publicação criada
  - `PUT banner` com `foto.chave` inexistente → 400 `"Foto não encontrada. Envie de novo."`
  - `PUT catalogo` link de outro site → 400; link do Google → grava normalizado
  - `PUT novidades {prazoDias: 0}` → 400; `{prazoDias: 30}` → `estado.pacotes[].classe` recalcula
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** commit `feat(api): estado e configurações do painel`.

### Tarefa 7: Cartões e pacotes

**Arquivos:** Modificar `api/config.ts`, `api/rotas/admin.ts`; criar `test/api/cartoes.test.ts`

**Interfaces:**
- Consome: `validaCartao`, `chavePacote`, `criaPublicacao`
- Produz: `POST /api/admin/cartoes` → `{ok, cartao, publicacao}` (ordem = maior + 1); `PUT /api/admin/cartoes/:id`; `DELETE /api/admin/cartoes/:id`; `PUT /api/admin/cartoes/ordem {ids}`; `PUT /api/admin/pacotes/:chave {modo}`. Rota `/cartoes/ordem` registrada antes de `/cartoes/:id`.

- [ ] **Passo 1: testes que falham:**
  - criar 2 cartões → ordens 1 e 2; `PUT ordem {ids:[2,1]}` → `estado.cartoes` volta na ordem nova
  - `PUT ordem` com ids faltando ou sobrando → 400 `"A lista de cartões mudou. Recarregue a página."`
  - `PUT /cartoes/99` → 404; `DELETE` → some do estado; cada mutação cria uma publicação
  - cartão com `fotoChave` inexistente no R2 → 400
  - `PUT /pacotes/13K {modo:"exc"}` → `classe: "exc"`; chave com espaço (`ARI%20EXCLUSIVO`) funciona; modo `"x"` → 400; pacote inexistente → 404
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** commit `feat(api): cartões de festa e classificação manual de pacotes`.

### Tarefa 8: Arquivos, teste de link e rotas do build

**Arquivos:** Criar `api/rotas/arquivos.ts`, `api/rotas/build.ts`, `test/api/arquivos.test.ts`, `test/api/build.test.ts`

**Interfaces:**
- Produz:
  - `POST /api/admin/arquivos` (multipart `tipo`, `arquivo`) → `{chave}`. Planilha: ≤ 10 MB (413), começa com `PK\x03\x04` (senão 415 `"Esse arquivo não é um .xlsx."`). Foto: ≤ 2 MB, bytes 0–3 `RIFF` e 8–11 `WEBP` (senão 415). Grava com `contentType`.
  - `GET /api/admin/arquivos/:chave*` — só `^(planilhas|fotos)/[\w.-]+$`; 404 se não existe
  - `GET /api/admin/link/teste?url=` → `{ok: true, id, linhas}` ou 400 (link inválido: `"Cole o link da planilha do Google (docs.google.com/spreadsheets/...)."`) ou 422 `"A planilha não está pública. Abra o compartilhamento no Google."` (resposta não-200, ou CSV sem `codigo` e `titulo` no cabeçalho)
  - `interface ConfigBuild { contato; banner; catalogo; novidades; cartoes: Cartao[] /* só ativos, em ordem */; pacotes: PacoteDb[]; musicasNoAr: number|null; hoje: string }` (em `src/lib/painel/tipos.ts`)
  - `GET /api/build/config` → `ConfigBuild`; `GET /api/build/arquivo/:chave*` → stream do R2
  - `POST /api/build/pacotes {pacotes:[{nome, musicas}]}` → `{classes: Record<string, Pacote>}` (por chave). Nome vazio é ignorado. Novo: `chegou_em = visto_em = hoje`. Existente: atualiza `musicas`, `visto_em`; `chegou_em` e `nome` não mudam.

- [ ] **Passo 1: testes que falham:**
  - upload de `.xlsx` real (bytes da fixture da Tarefa 9 ou um zip mínimo `PK\x03\x04...`) → chave `planilhas/2026-11-04-<x>.xlsx` (data fixa via `deps.agora`)
  - upload de PNG como foto → 415; foto de 2 MB + 1 byte → 413; nome do arquivo do usuário não aparece na chave
  - `GET /arquivos/../x` → 404
  - `link/teste` com `fetch` falso: 200 + CSV com cabeçalho → `ok`; 200 + HTML de login → 422; link de outro domínio → 400
  - `pacotes` com `"13K"` em `2026-11-04`; de novo com `"13k "` em `2026-11-10` → **uma** linha, `chegou_em` ainda `2026-11-04`, `visto_em` `2026-11-10` (Foco 2)
  - `build/config` traz só cartões ativos, em ordem, e `musicasNoAr`
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** commit `feat(api): uploads, teste do link e rotas do build`.

### Tarefa 9: Leitura do `.xlsx` (navegador e build)

**Arquivos:** Criar `src/lib/xlsx.ts`, `scripts/fixture-xlsx.ts`, `data/fixture/musicas.xlsx`, `test/xlsx.test.ts`; modificar `src/lib/planilha.ts`

**Interfaces:**
- Produz:
  - `class ErroPlanilha extends Error {}`
  - `lerAbaMusicas(dados: ArrayBuffer | Uint8Array): Record<string, string>[]` — `XLSX.read(dados, { type: "array" })`; aba cujo `normaliza(nome) === "musicas"`; `sheet_to_json(ws, { header: 1, raw: false, defval: "" })` → `comoObjetos`. Sem aba → `ErroPlanilha('O arquivo não tem a aba "Músicas".')`; sem `codigo` ou `titulo` → `ErroPlanilha("A aba Músicas precisa das colunas codigo e titulo.")`
  - Em `planilha.ts`: `contaPacotes(linhas): { nome: string; musicas: number }[]` (por `chavePacote`, grafia mais usada) e `montaMusicas(linhas, tipo: (pacote: string) => Pacote = tipoPacote)`
  - `previaPlanilha(linhas, pacotesConhecidos: string[], musicasNoAr: number | null): { musicas: number; pacotes: number; novos: string[]; ignoradas: number; abaixoDaMetade: boolean }`
- [ ] **Passo 1:** `scripts/fixture-xlsx.ts` gera `data/fixture/musicas.xlsx` a partir de `musicas.csv` (todas as células como texto). Rodar e commitar o `.xlsx`.
- [ ] **Passo 2: testes que falham:**
  - `montaMusicas(lerAbaMusicas(xlsx da fixture))` deep-equal a `montaMusicas(csv da fixture)`
  - planilha montada em memória com `codigo` numérico `550`, formato `"00000"` → `"00550"` (Foco 1)
  - aba chamada `"MÚSICAS"` funciona; sem a aba → `ErroPlanilha` com a mensagem exata
  - `contaPacotes` junta `"13K"` e `"13k "`
  - `previaPlanilha` com `musicasNoAr = 1000` e 95 músicas → `abaixoDaMetade: true`; `novos` lista só os que não estão em `pacotesConhecidos`
- [ ] **Passo 3:** → FALHAM. **Passo 4:** implementar. **Passo 5:** → PASSAM, e `pnpm test` inteiro passa (testes antigos de `planilha.test.ts` inalterados).
- [ ] **Passo 6:** commit `feat: leitura do catálogo em .xlsx`.

### Tarefa 10: Build lendo do painel

**Arquivos:** Criar `scripts/painel.ts`, `src/lib/build.ts`, `data/fixture/config.json`, `data/fixture/r2/fotos/ari-cantando.webp` (cópia), `data/fixture/r2/fotos/telao.webp` (foto de teste 16:9), `test/build.test.ts`; reescrever `scripts/planilha.ts`; ajustar `package.json` (`build:painel-local`)

**Interfaces:**
- Consome: `ConfigBuild`, `lerAbaMusicas`, `contaPacotes`, `montaMusicas`, `classifica`, `hojeSP`, `formataZap`, `letreiro`, `quebraNoMeio`, `negrito`
- Produz:
  - `clientePainel(base: string, token: string, f?: typeof fetch): { config(): Promise<ConfigBuild>; arquivo(chave: string): Promise<ArrayBuffer>; pacotes(l: {nome: string; musicas: number}[]): Promise<Record<string, Pacote>>; status(c: {publicacao?: number; status: string; erro?: string; runUrl?: string; musicas?: number}): Promise<{publicacao: number}> }` — 3 tentativas como hoje
  - `confereTamanho(total: number, musicasNoAr: number | null, forcar: boolean): string | null` → `"O catálogo novo tem <total> músicas, menos da metade das <noAr> que estão no ar. Confirme no painel para publicar mesmo assim."`
  - `interface Manifesto` = o de hoje + `contato: { zapContato; zapKj /* já com fallback */; zapTexto; instagram; facebook }`, `banner: { linhas: Palavra[][]; rotulo: string; frase: {texto; forte}[]; legenda: [[string,string],[string,string]]; foto: { src: string; recortada: boolean } }`, `servicos: { titulo; destaque; descricao; foto: string | null }[]`
  - `montaManifesto(base, config: ConfigBuild, fotos: Map<string, string>): Manifesto`
- Fluxo de `planilha.ts`: online exige `PAINEL_URL` e `BUILD_TOKEN` (senão erro `"Falta PAINEL_URL/BUILD_TOKEN. Para testar sem rede use --offline."`). `config()` → fonte `arquivo` (`arquivo(chave)` + `lerAbaMusicas`) ou `link` (CSV gviz como hoje, id de `config.catalogo.link`) → `pacotes(contaPacotes(...))` → `montaMusicas(linhas, p => classes[chavePacote(p)] ?? "base")` → `confereTamanho` (lança erro) → fotos baixadas para `public/img/painel/<sha256 10>.webp` → JSONs. Offline: `data/fixture/config.json` (sem `pacotes` → todo pacote conta como chegado hoje), fotos de `data/fixture/r2/`. `versao.txt` = hash dos arquivos + manifesto sem `geradoEm`/`primeiras`. Qualquer erro é gravado em `.erro-build.txt` antes de sair com código 1.
- `config.json` da fixture: contato com `zapKj: "5512981234567"` (diferente do contato, para o e2e), banner = `CONFIG_PADRAO.banner`, cartões = os 4 de `produtos.csv` sem "Contato para locação", o 4º ("Aluguel de Telão") com foto `fotos/telao.webp`.

- [ ] **Passo 1: testes que falham** (`build.test.ts`):
  - `confereTamanho(400, 1000, false)` → mensagem; `(400, 1000, true)` → `null`; `(500, 1000, false)` → `null`; `(10, null, false)` → `null`
  - `montaManifesto` com `zapKj: null` → `contato.zapKj === zapContato`; `zapTexto === "(12) 99116-7274"`
  - cartão sem foto → `foto: null`; com foto → `"/img/painel/<hash>.webp"`
  - `banner.legenda` → `[["Com Ari","Ribeiro"],["aqui a diversão","é garantida"]]`
  - `clientePainel` com `fetch` falso: manda `Authorization: Bearer <token>`; 500 duas vezes e 200 na terceira → resolve
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** `pnpm build:offline` → imprime `"95 músicas (fixture offline) · ... · 4 serviços"` (número real do fixture) e `src/data/gerado/manifesto.json` tem `contato`, `banner`, `servicos[3].foto`.
- [ ] **Passo 6:** commit `feat(build): dados do site vindos do painel`.

### Tarefa 11: Site usando a config (sem valores fixos)

**Arquivos:** Modificar `src/pages/index.astro`, `src/scripts/catalogo.ts`, `src/styles/global.css`, `e2e/catalogo.e2e.ts`

**Interfaces:**
- Consome: `Manifesto` (Tarefa 10), `htmlLetreiro`, `htmlPoster` (Tarefa 3)
- Produz: `<script id="manifesto">` passa a ter `zapKj` e `zapContato`. `const ZAP` some dos dois arquivos.

Mudanças: letreiro e pôster vêm de `htmlLetreiro`/`htmlPoster` (`set:html`), `aria-label` = `banner.rotulo`. Frase de baixo com `<b>` nos trechos fortes. Foto `recortada` → como hoje; senão `<img class="cheia">` com `object-fit: cover` preenchendo `.area`. Zap do KJ: comanda e "Pedir pro KJ". Zap de contato: cartões, rodapé, "Pedir música nova". Rodapé: mantém o rótulo "Instagram e Facebook" e o link do Instagram; se `facebook` existir, um segundo link `facebook.com/<usuário>`. Cartão com foto: `<img>` 16:9 no topo do `.cz`, `loading="lazy"`, `alt=""`; sem foto o HTML é igual ao de hoje.

- [ ] **Passo 1: testes e2e que falham:**
  - sem JS: `#letreiro` tem `aria-label="Solta a voz, o palco é seu"` e 4 `.w`; `.lede b` = "código"
  - o 4º cartão tem `img` com proporção 16:9 (`naturalWidth/naturalHeight` ≈ 1,78) e os outros não têm `img`
  - "Mandar pro KJ" com 1 música → `href` começa com `https://wa.me/5512981234567`; link do rodapé → `https://wa.me/5512991167274`; cartão → `5512991167274`
  - busca sem resultado → "Pedir música nova" usa `5512991167274`
- [ ] **Passo 2:** `pnpm e2e` → os novos FALHAM.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `pnpm e2e` → **todos** passam (antigos e novos, 3 projetos). `pnpm check` limpo. `grep -rn "5512991167274" src/` → nada.
- [ ] **Passo 5:** commit `feat(site): banner, contatos e cartões vindos do painel`.

### Tarefa 12: Importação inicial e `pnpm painel`

**Arquivos:** Criar `scripts/importa-sql.ts`, `scripts/importa.ts`, `scripts/painel-local.ts`, `test/importa.test.ts`; modificar `package.json` (`painel`, `importa`), `playwright.config.ts`

**Interfaces:**
- Consome: `CONFIG_PADRAO`, `montaServicos`, `contaPacotes`, `normalizaZap`, `chavePacote`
- Produz:
  - `sqlImportacao(d: { contato: Contato; banner: Banner; catalogo: FonteCatalogo; novidades: Novidades; cartoes: Omit<Cartao,"id">[]; pacotes: {nome: string; musicas: number}[]; hoje: string }): string` — idempotente: `INSERT OR IGNORE` em `config` e `pacotes`; cartões só se a tabela estiver vazia (`INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM cartoes)`). Strings com aspas simples escapadas.
  - `node scripts/importa.ts --alvo local|preview|producao [--offline]`: lê Produtos/Músicas (planilha atual, só leitura; ou fixture), contato do produto "Contato para locação", roda via `execFileSync` (sem shell): `wrangler d1 migrations apply DB`, `wrangler d1 execute DB --file <tmp>`, `wrangler r2 object put <bucket>/fotos/ari-cantando.webp --file public/img/ari-cantando.webp`. Flags: local `--local --persist-to .wrangler/painel`; preview `--env preview --remote`; producao `--remote`. Antes de `preview`/`producao`, pergunta "Confirma importar em <alvo>? (s/N)".
  - `pnpm painel` (`scripts/painel-local.ts`): apaga `.wrangler/painel`, cria `.dev.vars` do exemplo se faltar, `importa --alvo local --offline`, `pnpm build:offline`, `wrangler pages dev dist --port 8788 --persist-to .wrangler/painel`
  - `playwright.config.ts`: um só `webServer` = `pnpm painel`, `baseURL` `http://localhost:8788`, timeout 180 s; projetos do site com `testMatch: /catalogo\.e2e\.ts/`; novo projeto `painel` (Pixel 7, `testMatch: /painel\.e2e\.ts/`)

- [ ] **Passo 1: testes que falham** (`importa.test.ts`, executando o SQL num D1 do Miniflare):
  - rodar o SQL duas vezes → 4 cartões (não 8), pacotes sem duplicar, config igual
  - título com apóstrofo (`"Ari's"`) entra intacto
  - `estado` depois da importação: `contato.zapContato === "5512991167274"`, `catalogo.fonte === "link"`, todo pacote com `modo: "auto"` e `chegouEm` = data da importação
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** `pnpm painel` em segundo plano; `curl -s localhost:8788/api/admin/estado` → JSON com 4 cartões; `curl -s -o /dev/null -w "%{http_code}" localhost:8788/` → `200`. `pnpm e2e` → site todo passando em cima do `wrangler pages dev`.
- [ ] **Passo 6:** commit `feat: importação inicial e pnpm painel`.

### Tarefa 13: Painel · estrutura, status, Início e Contato

**Arquivos:** Criar `src/pages/admin/index.astro`, `src/styles/painel.css`, `src/scripts/painel/api.ts`, `src/scripts/painel/estado.ts`, `src/scripts/painel/status.ts`, `src/scripts/painel/main.ts`, `src/scripts/painel/telas/inicio.ts`, `src/scripts/painel/telas/contato.ts`, `test/status.test.ts`, `e2e/painel.e2e.ts`; modificar `public/_headers`

**Interfaces:**
- Produz:
  - `api<T>(metodo: string, rota: string, corpo?: unknown | FormData): Promise<T>` — lança `ErroApi { mensagem; status }`; falha de rede → `"Sem conexão com o servidor"`; 401 → recarrega a página (o Access pede login)
  - `estado`: `carrega(): Promise<Estado>`, `assina(fn)`, polling de 10 s enquanto a última publicação estiver `pendente`/`rodando`
  - `textoStatus(p: Publicacao | null, agora: Date): { tipo: "ok" | "publicando" | "demorando" | "falhou" | "nenhuma"; texto: string }` — `ok` → `"No ar ✅ desde 14:32"`; aberta há > 10 min → `"Está demorando. Avisa o Gabriel."`; `falhou` → motivo + `"O site continua com a versão anterior."`
  - `interface Tela { id: string; nome: string; monta(el: HTMLElement): void }`; navegação por `location.hash` (`#inicio`, `#catalogo`, `#novidades`, `#banner`, `#festa`, `#contato`)
- Visual: usar a skill `frontend-design` com as cores e fontes de `global.css` (papel, tinta, gravata, luz). Abas fixas embaixo no celular, lateral a partir de 1024 px. Todo botão com estados hover/toque/carregando/desabilitado. `<meta name="robots" content="noindex">`; `_headers` com `/admin*` → `X-Robots-Tag: noindex` e `Cache-Control: no-store`.

- [ ] **Passo 1: testes que falham:**
  - unit `textoStatus`: `ok` às 14:32 de Brasília → contém `"No ar ✅"` e `"14:32"`; `pendente` há 11 min → `"demorando"`; `falhou` com erro → texto contém o erro e `"versão anterior"`
  - e2e painel: abre `/admin`, faixa mostra `"No ar ✅"`; em Contato, Zap `"(12) 98888-7777"` → Salvar → aviso de sucesso; recarrega → campo mostra `"(12) 98888-7777"`; Zap `"1234"` → mensagem de erro ao lado do campo, nada salvo
  - e2e painel: rota de API bloqueada (`page.route("**/api/**", r => r.abort())`) → `"Sem conexão com o servidor"`
  - axe sem violação grave em Início e Contato
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** prints de `/admin#inicio` e `#contato` em 375/768/1024/1440; olhar cada um (overflow, texto cortado, menu em cada largura).
- [ ] **Passo 6:** commit `feat(painel): estrutura, status de publicação e contato`.

### Tarefa 14: Painel · Catálogo

**Arquivos:** Criar `src/scripts/painel/telas/catalogo.ts`; modificar `e2e/painel.e2e.ts`

**Interfaces:**
- Consome: `lerAbaMusicas`, `previaPlanilha` (import dinâmico, para o SheetJS só carregar nessa tela), `api`, rotas `arquivos`, `catalogo`, `link/teste`, `publicar`
- Fluxo: Fonte (Arquivo | Link). Arquivo: escolher `.xlsx` → prévia (nº de músicas, pacotes, pacotes novos, linhas ignoradas) → se `ErroPlanilha`, mensagem e Confirmar desabilitado → se `abaixoDaMetade`, caixa "Sim, o catálogo novo tem menos músicas mesmo" obrigatória (vira `forcar: true`) → Confirmar = `POST arquivos` + `PUT catalogo`. Link: colar → Testar → Salvar só habilitado depois de testar **esse mesmo** link. "Atualizar catálogo" (`POST publicar {motivo: "atualizar-catalogo"}`) visível quando a fonte é link.

- [ ] **Passo 1: testes e2e que falham:**
  - enviar `data/fixture/musicas.xlsx` → prévia com o nº de músicas da fixture → Confirmar → faixa `"No ar ✅"`; `estado.catalogo.fonte === "arquivo"`
  - enviar um `.xlsx` sem aba Músicas (gerado no teste com SheetJS em pasta temporária) → `'O arquivo não tem a aba "Músicas".'` e Confirmar desabilitado
  - com `musicasNoAr` alto (publicação `ok` com `musicas: 100000` gravada via `POST /api/build/status` com o token local) → prévia pede a confirmação extra
  - Link: digitar outro link depois de testar → Salvar volta a ficar desabilitado
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** prints 375/1440 da prévia. Commit `feat(painel): catálogo por arquivo ou link`.

### Tarefa 15: Painel · Novidades

**Arquivos:** Criar `src/scripts/painel/telas/novidades.ts`; modificar `e2e/painel.e2e.ts`

- Conteúdo: prazo (dias, 1–365), lista de pacotes (nome, chegada `dd/mm/aaaa`, nº de músicas, classificação atual como etiqueta igual à do site, seletor Automático/Novidade/Só no Ari/Normal), busca por nome (com `normaliza`), filtro "só os que estão como Novidade". Mudar o seletor salva na hora (`PUT pacotes/:chave`), com estado carregando na linha.

- [ ] **Passo 1: testes e2e que falham:** trocar um pacote para "Só no Ari" → etiqueta muda e continua após recarregar; buscar "excl" filtra; prazo `0` → erro, `30` → salva.
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** prints 375/1440. Commit `feat(painel): novidades e classificação de pacotes`.

### Tarefa 16: Painel · Banner (com prévia e foto)

**Arquivos:** Criar `src/scripts/painel/telas/banner.ts`, `src/scripts/painel/foto.ts`, `src/pages/admin/previa.astro`, `test/foto.test.ts`; modificar `e2e/painel.e2e.ts`

**Interfaces:**
- Produz:
  - `temTransparencia(rgba: Uint8ClampedArray): boolean` — verdadeiro se mais de 1% dos pixels tiver alfa < 250
  - `comprimeFoto(arquivo: File): Promise<{ blob: Blob; recortada: boolean }>` — canvas, lado maior 1200 px, `image/webp` qualidade 0.82; recusa se o navegador não gerar WebP (mensagem pedindo outro navegador)
  - `previa.astro`: importa `global.css`, tem só a `<section class="cartaz">`, ouve `message` com `{banner, fotoSrc}` e redesenha com `htmlLetreiro`/`htmlPoster` (palavras já "cantadas", sem animação)
- Tela: 3 linhas com contador `n/14`, frase de baixo (dica: `*palavra*` deixa em negrito), legenda (2 campos), foto (trocar/manter). Prévia em dois `iframe` de `/admin/previa` (375 e 1280 de largura, reduzidos com `transform: scale`), atualizada a cada digitação.

- [ ] **Passo 1: testes que falham:** unit `temTransparencia` (tudo opaco → `false`; 2% transparente → `true`); e2e: digitar "Canta" na linha 1 → a prévia (frame) mostra "Canta"; 15 letras → contador em vermelho e Salvar desabilitado; Salvar → `"No ar ✅"`; enviar `data/fixture/r2/fotos/telao.webp` como foto → prévia usa `img.cheia`.
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM.
- [ ] **Passo 5:** prints 375/1440. Commit `feat(painel): banner editável com prévia`.

### Tarefa 17: Painel · Pra sua festa

**Arquivos:** Criar `src/scripts/painel/telas/festa.ts`; modificar `e2e/painel.e2e.ts`

- Lista em cartões (mesmas cores do site), cada um com Editar, Ligar/Desligar, ↑ ↓, Apagar (confirmação num `<dialog>`: "Apagar o cartão <título>? Não dá para desfazer."). Formulário com contadores (40/30/160) e foto opcional (`comprimeFoto`, sem exigência de transparência). ↑↓ chama `PUT cartoes/ordem`.

- [ ] **Passo 1: testes e2e que falham:** criar "Cartão e2e" → aparece no fim; ↑ → sobe uma posição e continua após recarregar; desligar → etiqueta "Desligado"; apagar → pede confirmação, Cancelar mantém, Apagar remove.
- [ ] **Passo 2:** → FALHAM. **Passo 3:** implementar. **Passo 4:** → PASSAM; axe sem violação grave nas 6 telas.
- [ ] **Passo 5:** prints 375/768/1024/1440 de todas as telas do painel. Commit `feat(painel): cartões de festa`.

### Tarefa 18: Workflow e status do build

**Arquivos:** Criar `scripts/status.ts`, `test/status-build.test.ts`; modificar `.github/workflows/site.yml`

**Interfaces:**
- Produz: `node scripts/status.ts rodando|ok|falhou` — lê `PAINEL_URL`, `BUILD_TOKEN`, `PUBLICACAO`, `RUN_URL`; `ok` manda `musicas` de `src/data/gerado/manifesto.json`; `falhou` manda o conteúdo de `.erro-build.txt` ou `"O build falhou. Veja o log no GitHub."`; sem `PUBLICACAO` em `rodando`, grava `PUBLICACAO=<id>` em `$GITHUB_ENV`. Sem `PAINEL_URL` → não faz nada e sai 0 (PRs).
- `site.yml`: `on.repository_dispatch.types: [publicar]`; cron `17 9 * * *`; `env.PUBLICACAO: ${{ github.event.client_payload.publicacao }}`, `PAINEL_URL`/`BUILD_TOKEN` dos secrets (vazios em PR); passo `status rodando` no início (fora de PR); e2e só em `push`/`pull_request`; PR usa `pnpm build:offline`, o resto `pnpm build`; depois do deploy `status ok`; `if: failure()` → `status falhou`. Concorrência continua `site-${{ github.ref }}`, `cancel-in-progress: false`. A comparação de `versao.txt` continua só no cron.

- [ ] **Passo 1: teste que falha:** `status-build.test.ts` com `fetch` falso — `rodando` sem `PUBLICACAO` grava `PUBLICACAO=7` no arquivo de `GITHUB_ENV`; `falhou` lê `.erro-build.txt`.
- [ ] **Passo 2:** → FALHA. **Passo 3:** implementar. **Passo 4:** → PASSA.
- [ ] **Passo 5:** com `pnpm painel` rodando: `PAINEL_URL=http://localhost:8788 BUILD_TOKEN=<local> node scripts/status.ts rodando` → id; depois `ok` → `/admin` mostra `"No ar ✅"`. `pnpm build:painel-local` gera o site com os dados do painel local.
- [ ] **Passo 6:** validar o YAML com `pnpm dlx @action-validator/cli .github/workflows/site.yml` → sem erros. Commit `ci: publicar pelo painel e checagem diária`.

### Tarefa 19: README, prints e verificação final

**Arquivos:** Criar `scripts/prints.ts`; modificar `README.md`, `package.json` (`prints`)

- `pnpm prints` (precisa de `pnpm painel` no ar): salva em `prints/` o site e cada tela do painel em 375/768/1024/1440, e antes/depois de `.cartaz` e `#festa`: "antes" de `https://ari-ribeiro-karaoke.pages.dev` (só leitura), "depois" do local.
- README: como funciona agora (fluxo do SPEC §3), `pnpm painel`, `pnpm build:painel-local`, configuração única do SPEC §11 passo a passo (clique a clique, com o que é cada coisa), como renovar o `GH_DISPATCH_TOKEN`.

- [ ] **Passo 1:** implementar `prints.ts`, rodar, abrir cada imagem e listar diferenças contra o site atual. Cartaz e rodapé têm de ser iguais; o cartão com foto é a única diferença esperada.
- [ ] **Passo 2:** rodar e guardar a saída de: `pnpm check`, `pnpm test`, `pnpm e2e`, `pnpm build:offline`.
- [ ] **Passo 3:** revisão do branch inteiro por um revisor novo (só leitura, sem ver este plano como conclusão).
- [ ] **Passo 4:** commit `docs: painel do Ari no README`.

### Tarefa 20: Preview na Cloudflare ⏸ **pergunta ao Gabriel antes**

Nada aqui roda sem o "pode" do Gabriel. Preciso dele: e-mail do Ari, nome do time do Zero Trust e o AUD da aplicação Access.

- [ ] criar D1 e R2 de preview (`wrangler d1 create ari-painel-preview`, `wrangler r2 bucket create ari-arquivos-preview`) e pôr os IDs no `wrangler.toml`
- [ ] Access para `*.ari-ribeiro-karaoke.pages.dev/admin*` e `/api/admin*` (Gabriel faz no painel, com o passo a passo do README)
- [ ] secrets de preview (`BUILD_TOKEN`, `GH_DISPATCH_TOKEN`) e `node scripts/importa.ts --alvo preview`
- [ ] push do branch `painel` (com permissão) → deploy de preview; testar de ponta a ponta: login por código, salvar contato, ver a run do Actions, ver o site de preview mudar

### Tarefa 21: Produção ⏸ **pergunta ao Gabriel antes**

- [ ] D1/R2 de produção, Access de produção, secrets, `importa --alvo producao`
- [ ] PR `painel` → `main` (com permissão); depois do merge, conferir o site idêntico ao de antes (prints) e o Ari entrando no painel
