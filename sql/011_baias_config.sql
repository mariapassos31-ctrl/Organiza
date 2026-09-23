-- =====================================================================
-- Escala TI - configuração de baias
-- Marca quais baias (por equipe) são exclusivas de Aprendiz/Estagiário —
-- configurável pela tela de Usuários, sem precisar mexer em código.
-- Nasce vazia (nenhuma baia marcada); a escolha é feita pelo switch.
-- =====================================================================

SET search_path TO "escala_ti";

CREATE TABLE IF NOT EXISTS "escala_ti"."baias_config" (
  cd_equipe    INTEGER NOT NULL,
  nr_baia      INTEGER NOT NULL,
  sn_aprendiz  BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT pk_baias_config PRIMARY KEY (cd_equipe, nr_baia),
  CONSTRAINT fk_baias_config_equipe FOREIGN KEY (cd_equipe)
    REFERENCES "escala_ti"."equipes" (cd_equipe) ON DELETE CASCADE
);
