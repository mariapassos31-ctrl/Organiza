-- =====================================================================
-- Escala TI - imagem do mapa da sala guardada no banco (upload de
-- verdade pela tela, em vez de precisar digitar um caminho de arquivo).
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."salas" ADD COLUMN IF NOT EXISTS ds_imagem_dados BYTEA;
ALTER TABLE "escala_ti"."salas" ADD COLUMN IF NOT EXISTS ds_imagem_tipo VARCHAR(50);
