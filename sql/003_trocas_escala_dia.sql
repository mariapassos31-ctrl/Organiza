-- =====================================================================
-- Escala TI - suporte a troca de um único dia dentro de uma escala
-- dt_dia NULL = troca da escala inteira; dt_dia preenchido = troca só
-- daquele dia específico dentro do período da escala.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."trocas_escala"
  ADD COLUMN IF NOT EXISTS dt_dia DATE;
