-- =====================================================================
-- Escala TI - elegibilidade manual para home office
-- Além da regra automática (Aprendiz e Supervisor nunca vão pra home
-- office), a gestora pode desmarcar qualquer outro técnico manualmente
-- pra ele nunca ser sorteado no rodízio de home office.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."tecnicos"
  ADD COLUMN IF NOT EXISTS sn_elegivel_home_office BOOLEAN NOT NULL DEFAULT true;
