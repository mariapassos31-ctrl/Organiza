-- =====================================================================
-- Escala TI - baia fixa
-- Marca se a baia de um técnico é fixa dele (ex: sempre volta pra ela
-- quando está presencial). Quando ele está de home office, a baia fica
-- disponível — mas por padrão ninguém mais é movido pra lá, já que hoje
-- sempre sobra baia (9 baias, no máximo 2 pessoas de home office por vez).
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."tecnicos"
  ADD COLUMN IF NOT EXISTS sn_baia_fixa BOOLEAN NOT NULL DEFAULT false;
