-- =====================================================================
-- Escala TI - troca mútua
-- Até aqui, uma "troca" era só entrega: o solicitante dava a própria
-- escala (ou um dia dela) pro destino, sem receber nada em troca. Agora
-- o solicitante pode também pedir uma escala específica do destino em
-- troca — quando aceita, as duas escalas trocam de dono.
-- cd_escala_solicitada é opcional (nulo = continua sendo só entrega,
-- como já funcionava antes desta migração).
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."trocas_escala"
  ADD COLUMN IF NOT EXISTS cd_escala_solicitada INTEGER;

ALTER TABLE "escala_ti"."trocas_escala"
  ADD CONSTRAINT fk_trocas_escala_escala_solicitada FOREIGN KEY (cd_escala_solicitada)
    REFERENCES "escala_ti"."escalas" (cd_escala) ON DELETE CASCADE;
