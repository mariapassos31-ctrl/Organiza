-- =====================================================================
-- Escala TI - configuração do Laboratório: quem é o responsável fixo e
-- quem cobre esse posto quando o responsável estiver de home office.
-- Configurável pela tela de Usuários, sem precisar mexer em código pra
-- trocar quem ocupa cada papel.
-- =====================================================================

SET search_path TO "escala_ti";

CREATE TABLE IF NOT EXISTS "escala_ti"."laboratorio_config" (
  cd_equipe               INTEGER PRIMARY KEY,
  cd_usuario_responsavel  INTEGER,
  cd_usuario_backup       INTEGER,
  CONSTRAINT fk_laboratorio_config_equipe FOREIGN KEY (cd_equipe)
    REFERENCES "escala_ti"."equipes" (cd_equipe) ON DELETE CASCADE,
  CONSTRAINT fk_laboratorio_config_responsavel FOREIGN KEY (cd_usuario_responsavel)
    REFERENCES "escala_ti"."usuarios" (cd_usuario) ON DELETE SET NULL,
  CONSTRAINT fk_laboratorio_config_backup FOREIGN KEY (cd_usuario_backup)
    REFERENCES "escala_ti"."usuarios" (cd_usuario) ON DELETE SET NULL
);
