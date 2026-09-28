-- =====================================================================
-- Escala TI - configuração do Externo: quem é o responsável fixo e quem
-- cobre esse posto quando o responsável estiver de home office. Mesmo
-- padrão do Laboratório (013_laboratorio_config.sql) — configurável pela
-- tela de Salas, sem precisar mexer em código pra trocar quem ocupa cada
-- papel.
-- =====================================================================

SET search_path TO "escala_ti";

CREATE TABLE IF NOT EXISTS "escala_ti"."externo_config" (
  cd_equipe               INTEGER PRIMARY KEY,
  cd_usuario_responsavel  INTEGER,
  cd_usuario_backup       INTEGER,
  CONSTRAINT fk_externo_config_equipe FOREIGN KEY (cd_equipe)
    REFERENCES "escala_ti"."equipes" (cd_equipe) ON DELETE CASCADE,
  CONSTRAINT fk_externo_config_responsavel FOREIGN KEY (cd_usuario_responsavel)
    REFERENCES "escala_ti"."usuarios" (cd_usuario) ON DELETE SET NULL,
  CONSTRAINT fk_externo_config_backup FOREIGN KEY (cd_usuario_backup)
    REFERENCES "escala_ti"."usuarios" (cd_usuario) ON DELETE SET NULL
);
