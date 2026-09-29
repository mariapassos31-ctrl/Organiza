-- =====================================================================
-- Escala TI - período de férias do técnico
-- Cadastrado direto no perfil do técnico (tela de Usuários). Quem tem um
-- período de férias sobreposto à data pedida é automaticamente pulado
-- na geração automática de escalas.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."tecnicos"
  ADD COLUMN IF NOT EXISTS dt_ferias_inicio DATE;

ALTER TABLE "escala_ti"."tecnicos"
  ADD COLUMN IF NOT EXISTS dt_ferias_fim DATE;
