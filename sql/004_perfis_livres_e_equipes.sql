-- =====================================================================
-- Escala TI - perfis livres, matrícula e novas equipes
-- - Remove a trava de perfis fixos: admin passa a poder cadastrar
--   qualquer perfil (texto livre), não só admin/gestor/tecnico/analista.
-- - Adiciona matrícula do colaborador.
-- - Adiciona as equipes Projetos e Dev.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."usuarios"
  DROP CONSTRAINT IF EXISTS ck_usuarios_tp_role;

ALTER TABLE "escala_ti"."usuarios"
  ADD COLUMN IF NOT EXISTS ds_matricula VARCHAR(30);

INSERT INTO "escala_ti"."equipes" (tp_equipe, nm_equipe, ds_cor) VALUES
  ('projetos', '📁 Projetos', '#f39c12'),
  ('dev',      '🧑‍💻 Dev',      '#9b59b6')
ON CONFLICT (tp_equipe) DO NOTHING;
