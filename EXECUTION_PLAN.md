# Shopper Trilha — Plano de Execução para Claude

## Regra geral
Antes de qualquer alteração, Claude deve ler `PROJECT_CONTEXT.md` e obedecer às decisões registradas. Não redesenhar arquitetura sem solicitação explícita.

## Fase 0 — Auditoria da V1 offline atual
Objetivo: entender o código já criado e preservar o que for útil.

Entregáveis:
- mapa de pastas e arquivos;
- stack atual;
- telas existentes;
- componentes reutilizáveis;
- lógica mockada/hardcoded;
- riscos para migração online;
- proposta de refatoração mínima.

Não implementar mudanças nesta fase.

## Fase 1 — Fundação do projeto online
Objetivo: preparar aplicação para produção.

Tarefas:
1. Confirmar/migrar projeto para Next.js, preferencialmente TypeScript.
2. Configurar variáveis de ambiente.
3. Criar conexão server-side com Supabase/PostgreSQL.
4. Criar migrations usando `DATABASE_SCHEMA.sql` como referência.
5. Criar estrutura de serviços/repositories para banco.
6. Não expor secrets no frontend.

Critério de aceite:
- aplicação inicia localmente;
- banco conectado;
- migrations aplicáveis sem erro;
- secrets fora do bundle do cliente.

## Fase 2 — Autenticação própria
Objetivo: substituir entrada fake por login real.

Tarefas:
1. Login com `login` + senha.
2. Verificação de hash no servidor.
3. Sessão segura via cookie httpOnly.
4. Bloquear login de usuário inativo.
5. Atualizar `last_login_at`.
6. Middleware/guards para `admin` e `student`.
7. Logout.

Critério de aceite:
- admin e student entram com permissões distintas;
- senha nunca trafega/retorna em respostas além do envio inicial;
- usuário inativo não entra.

## Fase 3 — Administração de usuários
Objetivo: CRUD seguro sem exclusão física.

Tarefas:
1. Tabela administrativa responsiva.
2. Criar usuário.
3. Editar nome, CD, turno, login e status.
4. Trilha/função selecionada a partir de `tracks` ativos.
5. Não permitir editar trilha após criação.
6. Redefinir senha.
7. Ativar/inativar.
8. Visualizar detalhe do usuário.

Critério de aceite:
- login único case-insensitive;
- matrícula pode repetir;
- trilha não muda após criação;
- inativação preserva histórico.

## Fase 4 — Integração com Google Drive
Objetivo: ler estrutura privada da Trilha de Liderança.

Tarefas:
1. Criar integração server-side com Google Drive API.
2. Configurar pasta raiz por variável de ambiente.
3. Ler fases.
4. Ler funções dentro da Fase 1.
5. Ler módulos.
6. Identificar exatamente 1 PDF por módulo.
7. Identificar `perguntas.json` opcional.
8. Usar IDs do Drive como identidade permanente.
9. Nunca expor credenciais ao cliente.

Critério de aceite:
- aplicação consegue mapear a estrutura real do Drive sem dar acesso aos alunos.

## Fase 5 — Prévia e confirmação de sincronização
Objetivo: atualizar estrutura somente após confirmação admin.

Tarefas:
1. Comparar Drive x banco.
2. Detectar adicionados, removidos, renomeados, reordenados e atualizados.
3. Validar `perguntas.json` quando existir.
4. JSON inválido gera warning e módulo é tratado como sem perguntas.
5. Exibir prévia.
6. Cancelar sem alterar banco.
7. Confirmar e aplicar.
8. Soft-delete com `active=false`.
9. Registrar `sync_history` e `sync_changes`.

Critério de aceite:
- renomear/reordenar pasta preserva registro pelo `drive_folder_id`;
- conteúdo removido não apaga histórico;
- nova fase/módulo aparece após confirmação.

## Fase 6 — Minha Trilha
Objetivo: substituir a navegação fake atual por dados reais.

Tarefas:
1. Carregar módulos aplicáveis ao usuário.
2. Fase 1 filtrada por `track_id`.
3. Fases comuns para todos.
4. Ordenar por ordem da fase e módulo.
5. Accordion por fase.
6. Percentual por fase.
7. Progresso geral.
8. Check em concluídos.
9. Destaque em atual/liberado.
10. Cadeado em bloqueados.
11. Nome de bloqueados permanece visível.
12. Fase do primeiro pendente abre por padrão.
13. Mobile-first.

Critério de aceite:
- progresso é calculado, não salvo;
- UI funciona em celular e desktop.

## Fase 7 — Regra de desbloqueio e progresso
Objetivo: implementar progressão sequencial e compatibilidade com novos conteúdos.

Tarefas:
1. Primeiro módulo da trilha começa liberado.
2. Acesso/conclusão libera o próximo conforme regra.
3. Último módulo de uma fase libera primeiro da próxima.
4. Persistir `unlocked_at`.
5. Novo módulo anterior entra como pendência sem bloquear novamente módulos já desbloqueados.
6. Módulos novos contam no progresso.
7. Módulos inativos deixam de contar.

Critério de aceite:
- inserir módulo no meio não apaga nem revoga progresso antigo.

## Fase 8 — Página do módulo e PDF privado
Objetivo: servir PDF sem conceder acesso ao Drive.

Tarefas:
1. Página própria por módulo.
2. Endpoint server-side para PDF.
3. Validar sessão e autorização do módulo antes de servir.
4. Visualizador embutido.
5. Botão Baixar PDF.
6. Primeiro acesso registra `material_accessed` e `material_accessed_at`.
7. Sem perguntas: primeiro acesso conclui o módulo.
8. Com perguntas: liberar área de quiz após acesso.

Critério de aceite:
- aluno não recebe URL privada do Drive;
- módulo bloqueado não pode ser baixado por chamada direta.

## Fase 9 — Quiz
Objetivo: implementar perguntas de fixação.

Tarefas:
1. Buscar/parsear `perguntas.json` no servidor.
2. Validar 4 alternativas por pergunta.
3. Embaralhar perguntas.
4. Embaralhar alternativas.
5. Não enviar gabarito ao frontend antes da submissão.
6. Corrigir no servidor.
7. Nota mínima 70%.
8. Tentativas ilimitadas.
9. Registrar `quiz_attempts` com snapshot.
10. Atualizar `best_score`.
11. Primeira aprovação marca módulo concluído permanentemente.
12. Resultado mostra acerto/erro e explicação opcional.
13. Botão `Ir para o próximo módulo`.

Critério de aceite:
- nova tentativa não remove aprovação anterior;
- nota menor não substitui melhor nota;
- gabarito não é exposto antes do envio.

## Fase 10 — Painel de acompanhamento
Objetivo: admin acompanhar alunos.

Tarefas:
1. Tabela com Nome, Matrícula, Trilha, CD, Turno, Progresso, Status, Último acesso.
2. Busca/filtros simples.
3. Detalhe por usuário.
4. Mostrar módulos, acessos, conclusão, notas, tentativas e datas.
5. Status de trilha calculado.

## Fase 11 — Hardening e publicação
Objetivo: preparar produção.

Tarefas:
1. Testes das regras críticas.
2. Proteção de rotas.
3. Validação server-side de inputs.
4. Rate limiting básico no login, se viável.
5. Logs sem senha/secrets.
6. Tratamento de erros.
7. Vercel deploy.
8. Variáveis de ambiente de produção.
9. Testes mobile.
10. Documentar processo de manutenção do Drive.

## Ordem obrigatória
Não pular direto para sincronização ou quizzes antes de banco, autenticação e estrutura de serviços estarem estáveis.
