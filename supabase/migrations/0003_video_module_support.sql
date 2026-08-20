-- SHOPPER TRILHA - SUPORTE A MÓDULOS COM VÍDEO (YouTube)
--
-- Compatível com os módulos PDF existentes: nenhuma coluna NOT NULL sem
-- default, material_type já nasce 'pdf' para todo módulo já cadastrado.

ALTER TABLE modules
  ADD COLUMN material_type TEXT NOT NULL DEFAULT 'pdf' CHECK (material_type IN ('pdf', 'youtube')),
  ADD COLUMN video_drive_id TEXT,
  ADD COLUMN video_external_id TEXT,
  ADD COLUMN video_titulo TEXT;

-- Percentual máximo já assistido do vídeo (nunca regride — mesma lógica
-- de "melhor nota" já usada em user_modules.best_score). Nula até o
-- aluno reportar o primeiro progresso.
ALTER TABLE user_modules
  ADD COLUMN video_watched_percent NUMERIC(5,2);
