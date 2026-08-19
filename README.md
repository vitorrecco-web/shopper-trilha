# Shopper Trilha — V2

Plataforma online de capacitação de supervisores. Ver `PROJECT_CONTEXT.md` para todas as regras de produto — este README é só sobre como rodar o que já existe.

**Status atual: Fases 1 a 11 do `EXECUTION_PLAN.md` concluídas — V1 completa.** Ver "Débito técnico conhecido" abaixo para o que foi conscientemente simplificado ou adiado para uma V2.

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

> ⚠️ **Solução provisória para a V1.** A abordagem original (Service
> Account) não funciona no Workspace da Shopper: a política de
> "domain-restricted sharing" do admin do Workspace impede compartilhar
> qualquer pasta com uma conta `...iam.gserviceaccount.com`, por ela não
> pertencer a um domínio permitido — a pasta nunca chega a ser
> compartilhada com a Service Account, então a API sempre veria "arquivo
> não encontrado", mesmo com credenciais corretas.
>
> Por isso a V1 autentica via **OAuth 2.0 com refresh token de uma conta
> corporativa que já tem acesso à pasta** — não é preciso compartilhar
> nada com uma identidade nova. O trade-off: o acesso fica amarrado a
> essa pessoa (se a conta for desativada, tiver a senha trocada com
> revogação de sessões, ou o consentimento for revogado, o refresh token
> para de funcionar e precisa ser gerado de novo).
>
> **Melhoria de produção a considerar depois (fora do escopo da V1):**
> pedir para um super-admin do Workspace configurar **Domain-Wide
> Delegation** na Service Account (Admin Console → Segurança → Controles
> de API → Delegação em todo o domínio). Isso permite a Service Account
> "personificar" um usuário do domínio sem depender de uma pessoa
> específica logada — mais robusto, mas exige acesso de super-admin que
> pode não estar disponível rapidamente.

**Passo a passo para gerar as credenciais OAuth:**

1. No [Google Cloud Console](https://console.cloud.google.com), no mesmo projeto onde a Drive API já está ativa, vá em **APIs e serviços → Credenciais**.
2. **Criar credenciais → ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em "URIs de redirecionamento autorizados", adicione: `https://developers.google.com/oauthplayground` (é só para gerar o refresh token uma vez — não é usado em produção).
3. Copie o **Client ID** e o **Client Secret** gerados → viram `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`.
4. Se a tela de consentimento OAuth do projeto estiver em modo "Teste", adicione como usuário de teste o e-mail da conta corporativa que você vai usar no passo 6 (Tela de consentimento OAuth → Usuários de teste).
5. Abra o [Google OAuth Playground](https://developers.google.com/oauthplayground).
6. No ícone de engrenagem (canto superior direito): marque **"Use your own OAuth credentials"** e cole o Client ID e Client Secret do passo 3.
7. Na coluna da esquerda ("Step 1"), no campo de escopo, cole `https://www.googleapis.com/auth/drive.readonly` e clique **Authorize APIs**.
8. Faça login com a **conta corporativa que já tem acesso à pasta "Trilha de Liderança"** (o seu usuário Shopper, por exemplo) e aceite o consentimento.
9. De volta ao Playground, clique **Exchange authorization code for tokens** ("Step 2"). Copie o **Refresh token** exibido → vira `GOOGLE_OAUTH_REFRESH_TOKEN`.
10. Pegue o ID da pasta raiz "Trilha de Liderança" pela URL do Drive (`.../folders/`**`ESSE_ID_AQUI`**) → vira `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
11. Adicione as 4 variáveis no `.env.local` (e depois na Vercel, em Project Settings → Environment Variables).

Nenhum compartilhamento novo de pasta é necessário — a conta usada no passo 8 já enxerga a pasta normalmente.

**Fase 5 — Sincronização com prévia e confirmação**
- `src/lib/sync/diffTrilha.ts` — lógica pura que compara a árvore lida do Drive contra o snapshot atual do banco (tracks/phases/modules, incluindo inativos) e produz a lista de mudanças (`added`/`removed`/`renamed`/`reordered`/`updated`) + avisos. Testada com um fixture cobrindo os 5 tipos de mudança simultaneamente (trilha nova, trilha removida, fase renomeada, módulo renomeado+reordenado+PDF trocado no mesmo módulo, módulo que ganhou perguntas, e o caso de "nada mudou") — 15/15 asserções passando.
- `src/lib/drive/validatePerguntas.ts` — valida `perguntas.json` contra o formato de `perguntas-modelo.json` (exatamente 4 alternativas, resposta correta por ID, sem IDs de pergunta duplicados). JSON inválido gera aviso e o módulo é tratado como sem perguntas (§8.1) — nunca quebra a sincronização. Testado com 6 casos (1 válido, 5 inválidos) — todos corretos.
- `src/lib/sync/driveSyncService.ts` — orquestra a parte de I/O: lê o Drive, valida `perguntas.json` de cada módulo, lê o banco, chama `diffTrilha`, e (só na confirmação) aplica os upserts/soft-deletes na ordem certa (tracks e phases antes de modules, por causa das FKs).
- `GET /api/admin/sync/preview` — só leitura, **nenhuma gravação no banco**, nem mesmo um registro de auditoria (§8, "cancelar sem alterar banco" é literal). Mostra também a data da última sincronização.
- `POST /api/admin/sync/confirm` — recalcula o diff do zero (nunca confia num plano vindo do cliente, evita aplicar uma prévia desatualizada), aplica, e grava `sync_history` + uma linha em `sync_changes` por mudança.
- `/admin/drive` — tela única (Drive + sincronização, unificada posteriormente): botão "Analisar alterações" busca em paralelo a estrutura lida do Drive e o diff contra o banco; mostra as duas, mais os avisos, e só então libera "Confirmar e sincronizar" / "Cancelar".

**Fase 6 — Minha Trilha**
- `src/lib/services/trilhaView.ts` — lógica pura que monta a visão da trilha (accordion por fase, percentuais, módulo "atual") a partir de fases + módulos ativos + `user_modules` do aluno. A persistência de `unlocked_at`/progressão em si é da Fase 7 — aqui só computamos, em memória, o que mostrar. Já implementa a regra de não travar de novo um módulo com `unlocked_at` já persistido, mesmo que um módulo novo seja inserido antes dele (§7.1/§7.3) — testado com um fixture reproduzindo exatamente esse cenário, mais transição entre fases e progresso geral. **18/18 asserções passando.**
- `src/lib/services/trilhaViewService.ts` — busca fases ativas + módulos ativos aplicáveis à trilha do usuário (`listActiveModulesForTrack` já filtra Fase 1 por `track_id` e inclui as fases comuns — nenhuma filtragem extra necessária) + `user_modules`, e chama a lógica pura acima.
- `/app` — accordion mobile-first: progresso geral no topo, percentual por fase (não por módulo), módulo concluído com check, módulo atual destacado, módulo bloqueado com cadeado e nome visível, fase do próximo pendente aberta por padrão.
- Percentuais são sempre calculados em runtime a partir de `modules`/`user_modules` — nunca lidos de um campo "progresso" salvo (§12).
- Abrir um módulo (ler PDF, responder quiz) ainda não existe — isso é a Fase 7/8.

**Fase 7 — Regra de desbloqueio e progresso**
- `src/lib/services/progressionService.ts` — `ensureFirstModuleUnlocked` (chamada pela Fase 6 toda vez que "Minha Trilha" é carregada — idempotente, só grava na primeira vez) e `unlockNextModule` (pronta para ser chamada pela Fase 8, quando um módulo sem perguntas é concluído, e pela Fase 9, quando o quiz é aprovado — ainda sem nenhuma UI chamando, porque essa UI só existe a partir da Fase 8).
- Usa o repositório `markUnlocked` (já existente desde a Fase 1) — idempotente por natureza (`WHERE unlocked_at IS NULL` no update), o que garante §7.1/§7.3: inserir um módulo novo antes de um já desbloqueado não trava ele de novo.
- Testado com um cenário completo simulando um repositório em memória: aluno novo → libera 1º módulo → conclui → libera o próximo → conclui o último da fase → libera automaticamente o 1º da fase seguinte → **sincronização insere um módulo novo no meio** → os módulos já liberados mantêm o mesmo timestamp (não são regravados) → o módulo novo entra como pendência, só é liberado quando o aluno alcança ele na sequência (não é liberado por sincronização). **8/8 asserções passando.**
- `buildOrderedModules` (extraída de `trilhaView.ts`, agora exportada) garante que a Fase 6 e a Fase 7 usam exatamente a mesma noção de "sequência global da trilha" — sem duplicar a lógica de ordenação.

**Fase 8 — Página do módulo e PDF privado**
- `src/lib/services/moduleAccessService.ts` — centraliza "esse módulo existe, é aplicável a este usuário, e está liberado" reaproveitando a mesma lógica de desbloqueio da Fase 6/7 (nunca há um módulo que apareça liberado em "Minha Trilha" e bloqueado aqui, ou vice-versa).
- `GET /api/modulos/[id]/pdf` — só serve o PDF depois de validar sessão + autorização; resposta idêntica (404 "Módulo não disponível") tanto para módulo inexistente quanto para módulo bloqueado, para não revelar qual dos dois casos é. Primeiro acesso grava `material_accessed`/`material_accessed_at`; se o módulo não tem perguntas, o primeiro acesso já conclui o módulo e libera o próximo (reaproveitando `markCompletedWithoutQuiz` + `unlockNextModule` da Fase 7). Suporta `?download=1` para forçar `Content-Disposition: attachment` em vez de `inline`.
- `/app/modulo/[id]` — página própria: volta para Minha Trilha, fase/módulo, visualizador (`<iframe>` apontando para a rota acima — o aluno nunca vê a URL do Drive), botão Baixar PDF, e a área de quiz (Fase 9) quando aplicável.
- Módulo bloqueado acessado direto pela URL da página redireciona para `/app`; acessado direto pela URL da API de PDF/quiz recebe 404 — nunca serve o conteúdo.

**Fase 9 — Quiz**
- `src/lib/quiz/quizService.ts` — busca e valida `perguntas.json` (reaproveitando o validador da Fase 5), embaralha perguntas e alternativas a cada chamada (`toPublicQuiz`, que nunca inclui `correta` nem `explicacao`), e corrige no servidor (`gradeSubmission`, pura, sempre por ID de alternativa — nunca por posição).
- `GET/POST /api/modulos/[id]/quiz` — GET devolve as perguntas embaralhadas sem gabarito, só depois do material já ter sido acessado (403 se não). POST corrige no servidor, grava `quiz_attempts` com o snapshot completo das perguntas usadas na correção, e só em caso de aprovação chama `markPassedAndMaybeUpdateBestScore` + `unlockNextModule` — uma tentativa reprovada nunca desmarca uma aprovação anterior nem abaixa a melhor nota (a função de repositório da Fase 1 já garante isso; aqui só não a chamamos em caso de reprovação).
- Interface no módulo: perguntas em rádio button, resultado mostra acerto/erro por pergunta + explicação quando houver, botão "Ir para o próximo módulo" só aparece após aprovação — nunca avança automaticamente.

## Testes executados (Fases 8 e 9)

Como não há como testar contra o Drive/Supabase reais a partir daqui, a lógica foi validada com fixtures em memória, fora do projeto (mesmo padrão das fases anteriores):

- **Correção do quiz** (11 asserções): nota exata em 100%/75%/50%, pergunta sem resposta enviada conta como errada, correção por ID independente da ordem de envio, explicação nula quando não existe, `toPublicQuiz` nunca expõe `correta`/`explicacao`, quantidade de perguntas/alternativas preservada, embaralhamento realmente varia entre chamadas.
- **Fluxo integrado completo** (23 asserções): aluno novo → único módulo liberado → acessa PDF de um módulo sem quiz → conclui automaticamente → libera o próximo → módulo com quiz só libera a área de perguntas após acessar o material → tentativa reprovada não conclui nem libera o próximo → tentativa aprovada conclui e libera o próximo automaticamente → nova tentativa reprovada não desmarca a conclusão → nota mais baixa em tentativa posterior não substitui a melhor nota → histórico mantém todas as tentativas → módulo bloqueado (fase seguinte) não pode ser servido antes da hora → concluir o último módulo da trilha não aponta para nenhum próximo.
- **Build e typecheck**: limpos.
- **Guards**: `/app/modulo/[id]`, `/api/modulos/[id]/pdf` e `/api/modulos/[id]/quiz` sem sessão retornam 307/401; com sessão válida, passam do guard e chegam à camada de banco.
- **Bundle do cliente**: sem nenhuma ocorrência de segredo (`SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`).

**Fase 10 — Painel de acompanhamento**
- A tabela e o detalhe por usuário já existiam desde a Fase 3 (`/admin/usuarios`) com Nome, Matrícula, Trilha, CD, Turno, Progresso, Status e Último acesso, além de módulos/acessos/conclusão/notas/tentativas no detalhe — o que faltava era só o "status de trilha calculado" (tarefa 5) e filtros (tarefa 2).
- `src/lib/services/trackStatus.ts` (novo, sem `server-only` — usado tanto no servidor quanto em Client Components) — deriva **Não iniciado / Em andamento / Concluída / Sem módulos** a partir do mesmo `percent` já calculado, nunca lido de uma flag salva (§12).
- `/admin/usuarios` — nova coluna "Status da trilha" com badge colorido, e filtros por trilha e por status da conta (além da busca por nome/login/matrícula já existente).
- `/admin/usuarios/[id]` — mesmo badge de status de trilha na seção de progresso.

**Fase 11 — Hardening e publicação**
- **Rate limiting no login** (`src/lib/auth/rateLimiter.ts`) — até 5 tentativas por IP a cada 5 minutos, em memória. Testado: a 6ª tentativa consecutiva recebe `429`. Limitação documentada abaixo (não é uma garantia global em ambiente serverless multi-instância).
- **Tratamento de erros consolidado** — `requireActiveUserOrRespond` (novo, em `apiGuard.ts`) centraliza sessão + usuário ativo + erro de banco tratado, usado pelas rotas de PDF e quiz da Fase 8/9 (resolvendo o débito técnico que tinha sido anotado ali).
- **Logs sem segredo** — auditados todos os `console.error` do projeto: nenhum imprime senha, corpo de requisição, cookie de sessão ou variável de ambiente: só o objeto de erro da biblioteca (Supabase/Drive), que nunca contém credenciais.
- **Proteção de rotas** — já coberta desde as Fases 2-8 (middleware + revalidação em cada Server Component/Route Handler).
- **Validação server-side** — `zod` em todas as rotas que recebem corpo (login, criação/edição de usuário, redefinição de senha, submissão de quiz).
- **Vercel deploy + variáveis de ambiente de produção** — já em produção desde a Fase 1, validado a cada fase seguinte.
- **Testes mobile** — não há como testar em um aparelho físico a partir daqui; a interface foi construída mobile-first desde a Fase 2 (viewport correto, containers com `max-width`, alvos de toque com padding generoso). Recomenda-se uma checagem visual manual em um celular real antes de divulgar a URL para os supervisores.
- **Documentar processo de manutenção do Drive** — ver seção dedicada abaixo.

## Como manter a Trilha pelo Google Drive

Isto é para quem for adicionar/editar conteúdo depois — não precisa saber programar, só seguir a convenção de pastas.

### Estrutura de pastas

```
Trilha de Liderança/                    <- pasta raiz (GOOGLE_DRIVE_ROOT_FOLDER_ID)
├── Fase 1 - Conhecimento técnico/      <- "Fase N - assunto"
│   ├── Supervisor de Picking/          <- uma pasta por função (só na Fase 1)
│   │   ├── Módulo 1/
│   │   │   ├── Nome do conteúdo.pdf    <- vira o título exibido ao aluno
│   │   │   └── perguntas.json          <- opcional
│   │   ├── Módulo 2/
│   ├── Supervisor de Packing/
├── Fase 2 - CLT e regras internas/     <- fase comum: módulos direto, sem função
│   ├── Módulo 1/
│   │   └── Nome do conteúdo.pdf
```

### Regras que o sistema espera

- O nome da pasta da fase precisa começar com **"Fase N - "** (com um número e um hífen); o texto depois do hífen vira o nome exibido da fase.
- O nome da pasta do módulo precisa começar com **"Módulo N"**; esse número só define a ordem — o **título exibido ao aluno vem do nome do arquivo PDF**, sem a extensão `.pdf`.
- Cada módulo precisa ter **exatamente 1 PDF**. Se tiver 0 ou mais de 1, a sincronização mostra um aviso e não deixa o módulo pronto para publicar.
- `perguntas.json` é opcional. Quando existe, precisa seguir exatamente o formato de `perguntas-modelo.json` (4 alternativas por pergunta, resposta certa apontando para o `id` de uma alternativa). Se o arquivo estiver malformado, a sincronização avisa e o módulo é publicado **sem** perguntas até alguém corrigir o arquivo — nunca quebra a trilha inteira.
- Só a **Fase 1** tem a camada extra de "função" (Supervisor de Picking, de Packing, etc). Da Fase 2 em diante, os módulos ficam direto dentro da fase e valem para todo mundo.
- Renomear ou reordenar uma pasta existente é seguro — o sistema identifica cada fase/módulo/trilha pelo ID interno do Drive, não pelo nome. Só **excluir uma pasta e criar outra do zero** é que conta como conteúdo novo.
- Remover uma pasta (ou movê-la pra fora da estrutura) faz o conteúdo sumir da trilha dos alunos, mas o histórico de quem já tinha acessado/concluído continua no banco.

### Como aplicar uma mudança

1. Editar as pastas/arquivos no Drive como preferir (adicionar módulo, renomear fase, trocar o PDF, etc).
2. No painel do Shopper Trilha, entrar em **Drive e sincronização** (`/admin/drive`).
3. Clicar em **Analisar** — isso só lê o Drive e mostra uma prévia, nada é gravado ainda.
4. Conferir a lista de mudanças e os avisos. Se algo parecer errado, **Cancelar** e ajustar no Drive antes de tentar de novo — cancelar não altera nada no banco.
5. Se estiver tudo certo, clicar em **Confirmar e aplicar**.

Um módulo novo inserido no meio da trilha nunca desfaz o progresso de quem já passou por ali — ele entra como uma pendência a mais para quem ainda não chegou naquele ponto (§7.1).

## Testes executados ao longo do projeto (resumo)

Não foi configurado um framework de testes permanente (Jest/Vitest) no repositório — dado o tamanho da V1, cada fase teve sua lógica crítica validada com scripts de teste ad-hoc (fixtures em memória, sem depender de credenciais reais), rodados e conferidos antes de cada entrega:

| Fase | O que foi testado | Resultado |
|---|---|---|
| 4 | Mapeamento da árvore do Drive (fase comum vs. por trilha, PDF ausente/duplicado, pasta fora do padrão) | 13/13 |
| 5 | Diff Drive x banco (5 tipos de mudança simultâneos, inclusive "nada mudou") | 15/15 |
| 5 | Validação de `perguntas.json` (1 caso válido + 5 inválidos) | 6/6 |
| 6 | Montagem da trilha (desbloqueio sequencial, transição entre fases, progresso) | 18/18 |
| 7 | Persistência de desbloqueio + módulo novo inserido no meio | 8/8 |
| 9 | Correção do quiz (nota exata, ID vs. posição, embaralhamento, gabarito nunca exposto) | 11/11 |
| 8+9 | Fluxo integrado completo (acesso → conclusão → desbloqueio → quiz → histórico) | 23/23 |
| 11 | Rate limiting do login (6ª tentativa em 5 min recebe 429) | confirmado manualmente |

Se o projeto crescer, formalizar isso com Vitest (rodando as mesmas fixtures já escritas, com pouco retrabalho) é a recomendação natural — hoje os testes existem como scripts descartáveis criados durante o desenvolvimento, não como parte do repositório.

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
- `/admin/drive` e `/api/admin/sync/**` sem sessão retornam 307/401. `applySyncPlan` não é atômico entre tabelas (ver débito técnico abaixo).
- `/app` sem sessão retorna 307 para `/login`.

## Débito técnico conhecido (para uma V2)

- `next@14.2.35` ainda tem uma vulnerabilidade conhecida (GHSA-955p-x3mx-jcvp, exposição de endpoints internos de Server Functions) cuja correção definitiva exige Next 16 (major, breaking). Não fizemos esse salto para não introduzir mudança de arquitetura fora de escopo. Rodar `npm audit` para acompanhar.
- Sessão assinada (iron-session) não é revalidada contra o banco a cada requisição no middleware (Edge) — se um admin inativar um usuário no meio de uma sessão válida, o middleware ainda deixa passar até o cookie expirar (7 dias). As páginas Server Component (`/app`, `/admin`) e o CRUD de usuários (Fase 3) devem reforçar essa checagem quando fizer sentido; por ora é um trade-off aceito de performance vs. revogação instantânea.
- **PDF servido inteiro na memória do servidor** (`fetchDriveFileAsBuffer` carrega o arquivo todo antes de responder, sem streaming) — aceitável para os tamanhos de PDF de treinamento esperados aqui, mas não escala para arquivos muito grandes. Se algum PDF real ficar pesado, considerar `alt: "media"` com stream direto do Drive para a resposta em vez de bufferizar.
- **`perguntas.json` é buscado no Drive a cada `GET`/`POST` do quiz** (uma vez para mostrar as perguntas, outra para corrigir) — sem cache. Como a Fase 5 já valida o arquivo na sincronização, isso é redundante na maior parte do tempo; para poucos usuários simultâneos não é um problema, mas é um ponto de latência/cota da API do Drive a observar se o uso crescer.
- **Rate limiting do login é em memória, por instância** — em ambiente serverless (Vercel), cada instância fria da função tem sua própria contagem; não é um limite globalmente garantido entre múltiplas instâncias simultâneas, só uma primeira barreira contra tentativas repetidas na mesma instância. Uma garantia real exigiria armazenamento compartilhado (ex: Redis/Upstash) — deixado de fora da V1 por não haver essa infraestrutura disponível ainda.
- **Sem framework de testes formal no repositório** — a lógica crítica de cada fase foi validada com scripts ad-hoc durante o desenvolvimento (ver "Testes executados" acima), não com Jest/Vitest versionado. Migrar essas fixtures para testes de verdade é a recomendação mais simples de "dívida de qualidade" a pagar numa V2.
- **Autenticação com o Google Drive via OAuth 2.0 + refresh token de uma conta corporativa (Fase 4), em vez de Service Account** — contorna o "domain-restricted sharing" do Workspace da Shopper, mas amarra o acesso da aplicação a uma pessoa específica. Se essa conta for desativada, tiver a senha trocada com revogação de sessões, ou o consentimento OAuth revogado, o refresh token para de funcionar e precisa ser gerado de novo (ver "Configurar o acesso ao Google Drive" acima). Melhoria de produção a considerar: Domain-Wide Delegation, que exige um super-admin do Workspace autorizar a Service Account a personificar um usuário do domínio.
- **`applySyncPlan` (Fase 5) não é atômico** — o `supabase-js` fala com o Postgres via REST, sem suporte nativo a transações multi-tabela. Cada upsert/soft-delete é aplicado individualmente; se um item falhar no meio (ex: violação do índice único de ordem de fase), os itens já aplicados antes dele permanecem gravados, e a falha é reportada em `failures` no resultado + no `summary` do `sync_history`, mas a sincronização pode ficar parcialmente aplicada. Para uma V2, considerar mover a aplicação para uma função Postgres (`plpgsql`) chamada via RPC, que aí sim roda dentro de uma transação real.

## Estrutura

```
src/
  app/
    page.tsx                     # home — link para /login e /api/health
    login/page.tsx               # formulário de login (client component)
    app/page.tsx                 # Minha Trilha (dados reais, Fase 6)
    app/TrilhaAccordion.tsx        # accordion mobile-first (Client Component)
    app/modulo/[id]/page.tsx        # página própria do módulo (Fase 8)
    app/modulo/[id]/ModuloClient.tsx # visualizador PDF + quiz (Client Component)
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
        page.tsx                 # Drive + sincronização, tela única
        DriveSyncPanel.tsx        # analisar (estrutura + diff) / confirmar / cancelar
    api/
      health/route.ts            # diagnóstico de conexão com o banco
      auth/{login,logout,me}/route.ts
      admin/
        users/route.ts           # GET (listar) / POST (criar)
        users/[id]/route.ts       # GET (detalhe) / PATCH (editar)
        users/[id]/reset-password/route.ts
        tracks/route.ts           # GET trilhas ativas
        drive/preview/route.ts    # GET leitura do Drive (Fase 4)
        sync/preview/route.ts     # GET prévia da sincronização (Fase 5)
        sync/confirm/route.ts     # POST aplica a sincronização (Fase 5)
      modulos/[id]/
        pdf/route.ts               # GET serve o PDF privado (Fase 8)
        quiz/route.ts               # GET perguntas embaralhadas / POST corrige (Fase 9)
  components/
    LogoutButton.tsx
  lib/
    supabase/server.ts           # cliente Supabase server-side (service_role)
    db/types.ts                  # tipos espelhando o schema 1:1
    repositories/                # acesso a dados por tabela, sem regra de negócio
    services/
      userProgress.ts              # progresso calculado em runtime (§12, painel admin)
      trilhaView.ts                 # lógica pura da visão da trilha (Fase 6) + buildOrderedModules (Fase 7)
      trilhaViewService.ts           # busca fases/módulos/user_modules + monta a visão
      progressionService.ts           # persiste unlocked_at (Fase 7)
      moduleAccessService.ts           # autorização de acesso a módulo (Fase 8)
      trackStatus.ts                    # status de trilha calculado, sem server-only (Fase 10)
    quiz/
      quizService.ts                    # busca/valida/embaralha/corrige o quiz (Fase 9)
    drive/
      googleDriveClient.ts        # autenticação + chamadas à API do Drive
      trilhaMapper.ts              # lógica pura de mapeamento da árvore
      validatePerguntas.ts          # validação de perguntas.json (§4, §8.1)
      types.ts
    sync/
      diffTrilha.ts                 # lógica pura de diff Drive x banco
      driveSyncService.ts            # orquestra I/O (Drive + banco) em volta do diff
    auth/
      password.ts                 # hash/verify com bcrypt
      session.ts                   # config do iron-session (SessionData, cookie)
      getSession.ts                 # getCurrentSession / requireSession / requireAdminSession
      apiGuard.ts                   # requireAdminOrRespond + requireActiveUserOrRespond, para Route Handlers
      rateLimiter.ts                  # rate limiting básico do login em memória (Fase 11)
    utils/dbErrors.ts              # detecção de violação de unique do Postgres
  middleware.ts                    # guards de rota (/app, /admin, /api/admin), roda no Edge
scripts/
  seed-admin.mjs                  # bootstrap do primeiro admin
supabase/
  migrations/
    0001_init.sql
    0002_service_role_grants.sql
```

## V1 concluída

As 11 fases do `EXECUTION_PLAN.md` estão implementadas e validadas em produção. Os itens em aberto estão listados em "Débito técnico conhecido" acima — nenhum deles bloqueia o uso real pelos supervisores, são todos candidatos a uma V2.

