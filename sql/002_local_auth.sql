-- =====================================================================
-- Escala TI - remove dependência do Firebase Auth
-- Passa a autenticação a ser 100% local (email + senha com hash),
-- via Auth.js (Credentials provider). ds_firebase_uid deixa de ser
-- obrigatório/único; cd_usuario passa a ser o identificador único.
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."usuarios"
  ALTER COLUMN ds_firebase_uid DROP NOT NULL;

ALTER TABLE "escala_ti"."usuarios"
  DROP CONSTRAINT IF EXISTS uq_usuarios_ds_firebase_uid;

ALTER TABLE "escala_ti"."usuarios"
  ADD COLUMN IF NOT EXISTS ds_senha_hash VARCHAR(255);
