-- =====================================================================
-- Escala TI - perfis livres, matrícula e nova equipe
-- - Remove a trava de perfis fixos: admin passa a poder cadastrar
--   qualquer perfil (texto livre), não só admin/gestor/tecnico/analista.
-- - Adiciona matrícula do colaborador.
-- - Adiciona a equipe Projetos (Desenvolvedor é perfil da equipe Sistemas,
--   não uma equipe própria).
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."usuarios"
  DROP CONSTRAINT IF EXISTS ck_usuarios_tp_role;

ALTER TABLE "escala_ti"."usuarios"
  ADD COLUMN IF NOT EXISTS ds_matricula VARCHAR(30);

INSERT INTO "escala_ti"."equipes" (tp_equipe, nm_equipe, ds_cor) VALUES
  ('projetos', '📁 Projetos', '#f39c12')
ON CONFLICT (tp_equipe) DO NOTHING;
