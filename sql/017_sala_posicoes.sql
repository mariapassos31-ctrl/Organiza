-- =====================================================================
-- Escala TI - posições das baias na planta de cada sala, pra qualquer
-- sala com imagem própria poder ter o mesmo mapa visual clicável que o
-- Suporte já tem (não só a imagem do Suporte, que tem posição fixa no
-- código). Guardado à parte da reserva (sala_baias): a posição de uma
-- baia na planta não muda quando ela é liberada/reivindicada.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."salas" ADD COLUMN IF NOT EXISTS ds_posicoes JSONB;
