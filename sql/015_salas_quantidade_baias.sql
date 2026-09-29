-- =====================================================================
-- Escala TI - cada Sala passa a ter sua própria quantidade de baias
-- (times diferentes têm layouts diferentes) — configurável ao criar ou
-- editar a sala pela tela, sem precisar mexer em código.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."salas" ADD COLUMN IF NOT EXISTS qtd_baias INTEGER NOT NULL DEFAULT 9;
