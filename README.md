# Shopper Trilha — V2

Plataforma online de capacitação de supervisores. Ver `PROJECT_CONTEXT.md` para todas as regras de produto — este README é só sobre como rodar o que já existe.

**Status atual: Fases 1 e 2 do `EXECUTION_PLAN.md` concluídas** (fundação + autenticação própria). Minha Trilha, CRUD de usuários, quiz e sincronização com o Drive ainda **não existem** — isso é Fase 3 em diante.

## O que já existe

**Fase 1 — Fundação**
- Projeto Next.js 14 (App Router) + TypeScript, builda sem erros (`npm run build` testado).
- Conexão server-side com Supabase (`src/lib/supabase/server.ts`) — nunca importável de um componente cliente (protegido por `server-only`).
- Migrations (`supabase/migrations/`):
  - `0001_init.sql` — cópia fiel de `REFERENCE_DATABASE_SCHEMA.sql`, nenhuma regra alterada.
  - `0002_service_role_grants.sql` — necessária quando a exposição automática de tabelas na Data API do Supabase está desabilitada no projeto. Idempotente, e cobre tabelas futuras via `ALTER DEFAULT PRIVILEGES`.
- Camada de repositórios (`src/lib/repositories/*`) para as 7 tabelas do schema — só acesso a dados, sem regra de negócio.
- Endpoint `/api/health` para confirmar que a conexão com o banco funciona.

**Fase 2 — Autenticação própria**
- `POST /api/auth/login` — login + senha, hash com bcrypt (custo 12), bloqueia usuário `inactive`, mensagem genérica para login/senha errados (evita enumerar usuários existentes), erro tratado (503) se o banco estiver inacessível.
- `POST /api/auth/logout` — destrói a sessão.
- `GET /api/auth/me` — retorna a sessão atual (sem nunca expor `password_hash`).
- Sessão via **iron-session** — cookie httpOnly, `secure` em produção, `sameSite=lax`, 7 dias, conteúdo assinado/criptografado com `SESSION_SECRET`.
- `src/middleware.ts` — guarda `/app/**` (qualquer sessão válida) e `/admin/**` (só `role=admin`), roda no Edge.
- Páginas: `/login`, `/app` (placeholder autenticado), `/admin` (placeholder admin) — cada uma revalida a sessão de novo no Server Component, não confia só no middleware (defesa em profundidade).
- `scripts/seed-admin.mjs` — cria o primeiro usuário admin direto no banco (não existe cadastro público nem CRUD ainda — isso é Fase 3).

## Setup local

1. `npm install`
2. Criar um projeto no [Supabase](https://supabase.com).
3. Copiar `.env.example` para `.env.local` e preencher:
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (painel → Project Settings → API)
   - `DATABASE_URL` (painel → Project Settings → Database → Connection string → URI)
   - `SESSION_SECRET` — gerar com `openssl rand -base64 32`
4. Aplicar as migrations em `supabase/migrations/` (0001, depois 0002) no seu banco:
   - **Supabase CLI**: `supabase link` + `supabase db push`
   - **Manual**: colar o conteúdo de cada arquivo no SQL Editor do painel Supabase e rodar, na ordem.
5. Criar o primeiro admin:
   ```bash
   node --env-file=.env.local scripts/seed-admin.mjs "Seu Nome" seulogin SenhaForte123
   ```
6. `npm run dev`
7. Abrir `http://localhost:3000/api/health` — deve responder `{"ok":true,"tracks_count":0}`.
8. Abrir `http://localhost:3000/login` e entrar com o login/senha criados no passo 5 — deve cair em `/admin`.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` — build de produção (testado e passando)
- `npm run typecheck` — checagem de tipos isolada
- `npm run lint` — lint do Next.js
- `node --env-file=.env.local scripts/seed-admin.mjs "Nome" login senha` — cria o primeiro admin

## Segurança (validado nesta fase)

- `SUPABASE_SERVICE_ROLE_KEY` e `SESSION_SECRET` não aparecem em nenhum arquivo estático gerado em `.next/static` (verificado via build + grep).
- `bcryptjs` e qualquer referência a `password_hash` também não aparecem no bundle do cliente.
- Nenhuma variável de ambiente usa o prefixo `NEXT_PUBLIC_`.
- `password_hash` nunca é incluído em nenhuma resposta de API, em nenhum cenário (login, me, erro).
- Testado localmente: `/app` e `/admin` sem sessão retornam 307 para `/login`; login com corpo inválido retorna 400; logout sem sessão não quebra (200); banco inacessível no login retorna 503 com mensagem genérica, sem vazar stack trace ao cliente.

## Débito técnico conhecido (revisar na Fase 11 — Hardening)

- `next@14.2.35` ainda tem uma vulnerabilidade conhecida (GHSA-955p-x3mx-jcvp, exposição de endpoints internos de Server Functions) cuja correção definitiva exige Next 16 (major, breaking). Não fizemos esse salto para não introduzir mudança de arquitetura fora de escopo. Rodar `npm audit` para acompanhar.
- Sessão assinada (iron-session) não é revalidada contra o banco a cada requisição no middleware (Edge) — se um admin inativar um usuário no meio de uma sessão válida, o middleware ainda deixa passar até o cookie expirar (7 dias). As páginas Server Component (`/app`, `/admin`) e o CRUD de usuários (Fase 3) devem reforçar essa checagem quando fizer sentido; por ora é um trade-off aceito de performance vs. revogação instantânea.

## Estrutura

```
src/
  app/
    page.tsx                 # home — link para /login e /api/health
    login/page.tsx           # formulário de login (client component)
    app/page.tsx             # placeholder autenticado (student/admin)
    admin/page.tsx           # placeholder admin
    api/health/route.ts      # diagnóstico de conexão com o banco
    api/auth/login/route.ts
    api/auth/logout/route.ts
    api/auth/me/route.ts
  components/
    LogoutButton.tsx
  lib/
    supabase/server.ts       # cliente Supabase server-side (service_role)
    db/types.ts              # tipos espelhando o schema 1:1
    repositories/            # acesso a dados por tabela, sem regra de negócio
    auth/
      password.ts            # hash/verify com bcrypt
      session.ts              # config do iron-session (SessionData, cookie)
      getSession.ts            # getCurrentSession / requireSession / requireAdminSession
  middleware.ts               # guards de rota (/app, /admin), roda no Edge
scripts/
  seed-admin.mjs              # bootstrap do primeiro admin
supabase/
  migrations/
    0001_init.sql
    0002_service_role_grants.sql
```

## Próximos passos (Fase 3 do `EXECUTION_PLAN.md`)

CRUD de usuários pelo admin: criar, editar (nome/CD/turno/login/status — nunca a trilha), redefinir senha, ativar/inativar, ver detalhe. Login único case-insensitive já garantido pelo índice da migration; matrícula pode repetir.

