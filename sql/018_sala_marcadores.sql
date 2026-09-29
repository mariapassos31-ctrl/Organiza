-- =====================================================================
-- Escala TI - itens de referência na planta da sala (divisória, rack,
-- impressora, ou qualquer rótulo livre) — só marcam visualmente onde
-- ficam na planta, não são baia e não entram em reserva nenhuma.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."salas" ADD COLUMN IF NOT EXISTS ds_marcadores JSONB;
