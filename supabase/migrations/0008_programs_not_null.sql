-- UNIVERSIDADE SHOPPER — PROGRAMAS DE TREINAMENTO (parte 2)
--
-- Só rodar DEPOIS de confirmar que `scripts/bootstrap-program.mjs` já
-- backfillou `program_id` em TODAS as fases e tracks existentes (0007
-- deixou a coluna nullable de propósito para permitir esse backfill em
-- duas etapas, sem janela de indisponibilidade).
--
-- `users.program_id` FICA NULLABLE DE PROPÓSITO — mesmo padrão já usado
-- por `users.track_id` (nullable no banco; exigido só a nível de
-- aplicação para o fluxo de criação de ALUNO em /admin/usuarios/novo).
-- Um admin não pertence a um Programa específico — forçar NOT NULL aqui
-- quebraria `scripts/seed-admin.mjs`, que cria admin com `program_id: null`
-- de propósito, do mesmo jeito que já faz com `track_id: null`.
--
-- Se qualquer um dos ALTER abaixo falhar com "column contains null
-- values", o backfill não terminou — rode o script de novo antes de
-- tentar esta migration de novo.

ALTER TABLE phases ALTER COLUMN program_id SET NOT NULL;
ALTER TABLE tracks ALTER COLUMN program_id SET NOT NULL;
