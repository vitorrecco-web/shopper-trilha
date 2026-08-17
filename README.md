# Shopper Trilha — V2

Plataforma online de capacitação de supervisores. Ver `PROJECT_CONTEXT.md` para todas as regras de produto — este README é só sobre como rodar o que já existe.

**Status atual: Fase 1 do `EXECUTION_PLAN.md` concluída** (fundação). Login, Minha Trilha, quiz e sincronização com Drive ainda **não existem** — isso é Fase 2 em diante.

## O que já existe

- Projeto Next.js 14 (App Router) + TypeScript, builda sem erros (`npm run build` testado).
- Conexão server-side com Supabase (`src/lib/supabase/server.ts`) — nunca importável de um componente cliente (protegido por `server-only`).
- Migrations (`supabase/migrations/`):
  - `0001_init.sql` — cópia fiel de `REFERENCE_DATABASE_SCHEMA.sql`, nenhuma regra alterada.
  - `0002_service_role_grants.sql` — necessária quando a exposição automática de tabelas na Data API do Supabase está desabilitada no projeto. Sem isso, o `service_role` não tem privilégio sobre as tabelas e toda query falha (`/api/health` retornava `"step":"query"`). Idempotente, e cobre tabelas futuras via `ALTER DEFAULT PRIVILEGES`.
- Camada de repositórios (`src/lib/repositories/*`) para as 7 tabelas do schema — só acesso a dados, sem regra de negócio (isso vem nas próximas fases).
- Endpoint `/api/health` para confirmar que a conexão com o banco funciona.

## Setup local

1. `npm install`
2. Criar um projeto no [Supabase](https://supabase.com).
3. Copiar `.env.example` para `.env.local` e preencher:
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (painel → Project Settings → API)
   - `DATABASE_URL` (painel → Project Settings → Database → Connection string → URI)
4. Aplicar as migrations em `supabase/migrations/` (0001, depois 0002) no seu banco. Duas formas:
   - **Supabase CLI**: `supabase link` + `supabase db push`
   - **Manual**: colar o conteúdo do arquivo no SQL Editor do painel Supabase e rodar.
5. `npm run dev`
6. Abrir `http://localhost:3000/api/health` — deve responder `{"ok":true,"tracks_count":0}`.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` — build de produção (testado e passando)
- `npm run typecheck` — checagem de tipos isolada
- `npm run lint` — lint do Next.js

## Segurança (validado nesta fase)

- `SUPABASE_SERVICE_ROLE_KEY` não aparece em nenhum arquivo estático gerado em `.next/static` (verificado via build + grep).
- Nenhuma variável de ambiente usa o prefixo `NEXT_PUBLIC_` — por padrão, nada vaza ao cliente.
- `src/lib/supabase/server.ts` importa `server-only`: qualquer tentativa de importar esse módulo de um Client Component quebra o build, em vez de vazar em produção.

## Débito técnico conhecido (revisar na Fase 11 — Hardening)

- `next@14.2.35` ainda tem uma vulnerabilidade conhecida (GHSA-955p-x3mx-jcvp, exposição de endpoints internos de Server Functions) cuja correção definitiva exige Next 16 (major, breaking). Não fizemos esse salto agora para não introduzir uma mudança de arquitetura não solicitada fora de escopo da Fase 1. Rodar `npm audit` para acompanhar.

## Estrutura

```
src/
  app/
    page.tsx              # placeholder — Minha Trilha vem na Fase 6
    api/health/route.ts    # diagnóstico de conexão com o banco
  lib/
    supabase/server.ts      # cliente Supabase server-side (service_role)
    db/types.ts             # tipos espelhando o schema 1:1
    repositories/           # acesso a dados por tabela, sem regra de negócio
supabase/
  migrations/0001_init.sql  # cópia fiel de REFERENCE_DATABASE_SCHEMA.sql
```

## Próximos passos (Fase 2 do `EXECUTION_PLAN.md`)

Autenticação própria: login + senha com hash (bcrypt já está nas dependências), sessão via cookie httpOnly, bloqueio de usuário inativo, guards para `admin`/`student`.
