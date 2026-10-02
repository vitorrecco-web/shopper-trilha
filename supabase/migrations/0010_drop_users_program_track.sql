-- MATRÍCULAS (parte 2) — só rodar DEPOIS de confirmar que
-- `scripts/backfill-enrollments.mjs` já criou 1 `enrollment` para cada
-- `users` que tinha `program_id` preenchido. A partir daqui, `enrollments`
-- é a única fonte de verdade de qual(is) trilha(s) cada login tem.

ALTER TABLE users DROP COLUMN program_id;
ALTER TABLE users DROP COLUMN track_id;
