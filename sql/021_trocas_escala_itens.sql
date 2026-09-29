-- =====================================================================
-- Escala TI - troca com múltiplos itens
-- Uma troca podia até então trocar mútua (cd_escala <-> cd_escala_solicitada),
-- mas só UM par de escalas por solicitação — pra inverter um revezamento
-- de verdade (ex: dia 6 uma pessoa assume home e a outra presencial, dia
-- 13 é o inverso) era preciso criar duas trocas manuais separadas.
-- trocas_escala_itens guarda pares extras (cd_escala / cd_escala_solicitada)
-- ligados à mesma solicitação — cd_escala/cd_escala_solicitada em
-- trocas_escala continuam sendo o "item 1", sem mudança nenhuma: essa
-- tabela só existe quando a pessoa adiciona mais de um dia/período na
-- mesma troca.
-- =====================================================================

SET search_path TO "escala_ti";

CREATE TABLE IF NOT EXISTS "escala_ti"."trocas_escala_itens" (
  cd_item SERIAL PRIMARY KEY,
  cd_troca_escala INTEGER NOT NULL REFERENCES "escala_ti"."trocas_escala" (cd_troca_escala) ON DELETE CASCADE,
  cd_escala INTEGER NOT NULL REFERENCES "escala_ti"."escalas" (cd_escala) ON DELETE CASCADE,
  cd_escala_solicitada INTEGER REFERENCES "escala_ti"."escalas" (cd_escala) ON DELETE CASCADE
);
