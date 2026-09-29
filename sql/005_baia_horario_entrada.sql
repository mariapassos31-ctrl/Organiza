-- =====================================================================
-- Escala TI - horário de entrada e baia/dupla fixa dos técnicos
-- - hr_entrada: horário de entrada do técnico (ex: 07:00). Quem entra às
--   07:00 nunca pode ser escalado para home office.
-- - nr_baia: número da baia física fixa do técnico. Dois técnicos com o
--   mesmo nr_baia (na mesma equipe) formam uma "dupla de baia": o sistema
--   evita (melhor esforço) escalar os dois para home office no mesmo dia.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."tecnicos"
  ADD COLUMN IF NOT EXISTS hr_entrada TIME;

ALTER TABLE "escala_ti"."tecnicos"
  ADD COLUMN IF NOT EXISTS nr_baia INTEGER;
