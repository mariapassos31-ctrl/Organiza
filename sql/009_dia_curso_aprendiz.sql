-- =====================================================================
-- Escala TI - dia de curso do aprendiz
-- Aprendizes têm um dia fixo na semana em que estão no curso (não
-- presencial). 0 = domingo ... 6 = sábado (mesma convenção do
-- Date.getDay() do JavaScript). NULL = sem dia de curso configurado.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."tecnicos"
  ADD COLUMN IF NOT EXISTS nr_dia_curso SMALLINT;

ALTER TABLE "escala_ti"."tecnicos"
  ADD CONSTRAINT ck_tecnicos_nr_dia_curso CHECK (nr_dia_curso IS NULL OR nr_dia_curso BETWEEN 0 AND 6);
