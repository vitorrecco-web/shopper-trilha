# Shopper Trilha — V2

Plataforma online de capacitação de supervisores. Ver `PROJECT_CONTEXT.md` para todas as regras de produto — este README é só sobre como rodar o que já existe.

**Status atual: Fases 1, 2, 3 e 4 do `EXECUTION_PLAN.md` concluídas** (fundação + autenticação própria + administração de usuários + leitura do Drive). Sincronização com confirmação (gravar no banco) e a trilha do aluno ainda **não existem** — isso é Fase 5 em diante.

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

**Fase 3 — Administração de usuários**
- `/admin/usuarios` — tabela responsiva (Nome, Matrícula, Trilha, CD, Turno, Progresso, Status, Último acesso), com busca por nome/login/matrícula e ativar/inativar inline.
- `/admin/usuarios/novo` — criação de usuário (nome, matrícula, login, senha, trilha, CD, turno, status). Trilha vem de `GET /api/admin/tracks` (só trilhas `active=true`) — se não houver nenhuma trilha ativa ainda (antes da Fase 4/5 popular via Drive), a tela avisa e bloqueia a criação.
- `/admin/usuarios/[id]` — detalhe completo: dados cadastrais, progresso calculado em runtime (nunca salvo como flag — §12), edição de nome/CD/turno/login/status, redefinição de senha, histórico de módulos (material acessado, concluído, melhor nota) e histórico de tentativas de prova. **Trilha aparece só como leitura — não há campo para editá-la** (§11.3/§11.4: mudança de função exige novo cadastro).
- API: `GET/POST /api/admin/users`, `GET/PATCH /api/admin/users/[id]`, `POST /api/admin/users/[id]/reset-password`, `GET /api/admin/tracks` — todas exigem `role=admin`, guardadas tanto no middleware quanto em cada rota (defesa em profundidade).
- Login duplicado (case-insensitive) devolve erro 409 amigável em vez do erro cru do Postgres.

**Fase 4 — Integração com Google Drive (só leitura)**
- `src/lib/drive/googleDriveClient.ts` — autenticação via conta de serviço (JWT), nunca exposta ao cliente.
- `src/lib/drive/trilhaMapper.ts` — lógica pura que percorre a árvore de pastas e monta fases/trilhas/módulos, seguindo a convenção do §5 (`Fase N - assunto`, `Módulo N`, nome do módulo = nome do PDF sem extensão). Testada com uma árvore fake replicando o exemplo do `PROJECT_CONTEXT.md` + casos de erro de propósito (módulo sem PDF, PDF duplicado, pasta fora do padrão) — 13/13 asserções passando.
- `GET /api/admin/drive/preview` — lê o Drive agora e devolve a estrutura mapeada + avisos. **Não grava nada no banco** (isso é a Fase 5, com prévia e confirmação do admin).
- `/admin/drive` — tela que mostra essa leitura (fases, trilhas, módulos, PDF presente/ausente, perguntas.json presente) e a lista de avisos.
- Suporta tanto fases "comuns" (módulos direto na fase, ex: Fase 2 CLT) quanto fases "por trilha" (uma subpasta por função antes dos módulos, ex: Fase 1 Picking/Packing/...).

### Configurar o acesso ao Google Drive

1. No [Google Cloud Console](https://console.cloud.google.com), crie (ou reaproveite) um projeto.
2. Ative a **Google Drive API** (menu "APIs e serviços" → "Ativar APIs e serviços").
3. Crie uma **conta de serviço** ("IAM e administrador" → "Contas de serviço" → "Criar conta de serviço"). Não precisa de nenhuma permissão especial no projeto GCP.
4. Nessa conta de serviço, crie uma **chave** tipo JSON e baixe o arquivo.
5. No arquivo JSON baixado, copie:
   - `client_email` → vira `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → vira `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (mantenha os `\n` como estão)
6. No Google Drive, **compartilhe a pasta raiz "Trilha de Liderança"** com o e-mail da conta de serviço (o mesmo `client_email`), com permissão de **Leitor**. Sem esse compartilhamento, a API devolve "arquivo não encontrado" mesmo com credenciais corretas.
7. Pegue o ID da pasta raiz pela URL do Drive (`.../folders/`**`ESSE_ID_AQUI`**) → vira `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
8. Adicione as 3 variáveis no `.env.local` (e depois na Vercel).

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
- `/admin/usuarios/**` e `/api/admin/**` sem sessão retornam 307 (páginas) ou 401 JSON (API); com sessão válida de admin (testado com cookie iron-session gerado manualmente), a requisição passa do guard e chega até a camada de banco.
- `/api/admin/drive/preview` sem sessão retorna 401; sem credenciais do Google configuradas retorna 500 com mensagem clara (não crasha, não vaza stack trace).

## Débito técnico conhecido (revisar na Fase 11 — Hardening)

- `next@14.2.35` ainda tem uma vulnerabilidade conhecida (GHSA-955p-x3mx-jcvp, exposição de endpoints internos de Server Functions) cuja correção definitiva exige Next 16 (major, breaking). Não fizemos esse salto para não introduzir mudança de arquitetura fora de escopo. Rodar `npm audit` para acompanhar.
- Sessão assinada (iron-session) não é revalidada contra o banco a cada requisição no middleware (Edge) — se um admin inativar um usuário no meio de uma sessão válida, o middleware ainda deixa passar até o cookie expirar (7 dias). As páginas Server Component (`/app`, `/admin`) e o CRUD de usuários (Fase 3) devem reforçar essa checagem quando fizer sentido; por ora é um trade-off aceito de performance vs. revogação instantânea.

## Estrutura

```
src/
  app/
    page.tsx                     # home — link para /login e /api/health
    login/page.tsx               # formulário de login (client component)
    app/page.tsx                 # placeholder autenticado (student/admin)
    admin/
      page.tsx                   # painel do gestor (links)
      usuarios/
        page.tsx                 # tabela de usuários
        UsersTable.tsx
        novo/page.tsx             # criar usuário
        novo/NewUserForm.tsx
        [id]/page.tsx             # detalhe/editar usuário
        [id]/UserDetail.tsx
      drive/
        page.tsx                 # preview da estrutura do Drive
        DrivePreviewPanel.tsx
    api/
      health/route.ts            # diagnóstico de conexão com o banco
      auth/{login,logout,me}/route.ts
      admin/
        users/route.ts           # GET (listar) / POST (criar)
        users/[id]/route.ts       # GET (detalhe) / PATCH (editar)
        users/[id]/reset-password/route.ts
        tracks/route.ts           # GET trilhas ativas
        drive/preview/route.ts    # GET leitura do Drive (Fase 4)
  components/
    LogoutButton.tsx
  lib/
    supabase/server.ts           # cliente Supabase server-side (service_role)
    db/types.ts                  # tipos espelhando o schema 1:1
    repositories/                # acesso a dados por tabela, sem regra de negócio
    services/userProgress.ts      # progresso calculado em runtime (§12)
    drive/
      googleDriveClient.ts        # autenticação + chamadas à API do Drive
      trilhaMapper.ts              # lógica pura de mapeamento da árvore
      types.ts
    auth/
      password.ts                 # hash/verify com bcrypt
      session.ts                   # config do iron-session (SessionData, cookie)
      getSession.ts                 # getCurrentSession / requireSession / requireAdminSession
      apiGuard.ts                   # requireAdminOrRespond, para Route Handlers
    utils/dbErrors.ts              # detecção de violação de unique do Postgres
  middleware.ts                    # guards de rota (/app, /admin, /api/admin), roda no Edge
scripts/
  seed-admin.mjs                  # bootstrap do primeiro admin
supabase/
  migrations/
    0001_init.sql
    0002_service_role_grants.sql
```

## Próximos passos (Fase 5 do `EXECUTION_PLAN.md`)

Prévia e confirmação de sincronização: comparar a leitura do Drive (já pronta na Fase 4) contra o que existe no banco, mostrar novos/removidos/renomeados/reordenados/avisos, e só gravar (`upsert`/`active=false`) depois do admin confirmar. Inclui validar `perguntas.json` quando existir, sem quebrar o módulo se for inválido (§8.1).

