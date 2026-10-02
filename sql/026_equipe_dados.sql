-- =====================================================================
-- Escala TI - nova equipe Dados
-- O TIME "DADOS" que vem da VW_TIME (RH/Oracle, ver src/lib/mapaEquipeRh.ts)
-- não tinha equivalente no Organiza — 6 pessoas ficavam sem equipe
-- automática na sincronização com o GAU.
-- =====================================================================

SET search_path TO "escala_ti";

INSERT INTO "escala_ti"."equipes" (tp_equipe, nm_equipe, ds_cor) VALUES
  ('dados', '🗄️ Dados', '#16a085')
ON CONFLICT (tp_equipe) DO NOTHING;
