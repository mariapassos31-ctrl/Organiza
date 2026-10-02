-- Evita duplicar o mesmo período de férias pro mesmo técnico quando a
-- importação do RM (ver src/lib/rhFerias.ts) roda mais de uma vez.
ALTER TABLE "escala_ti"."tecnico_ferias"
  ADD CONSTRAINT uq_tecnico_ferias_periodo UNIQUE (cd_tecnico, dt_inicio, dt_fim);
