-- =====================================================================
-- Escala TI - generaliza "Configurar Baias" + "Sala Compartilhada" num
-- conceito único de Sala: um espaço físico, com uma lista de equipes que
-- podem usá-lo (editável, não fixa em código) e uma imagem opcional do
-- mapa (NULL = ainda sem planta baixa, mostra lista simples).
--
-- O tipo de reserva por baia não é escolhido manualmente — é automático:
-- sala com 1 equipe só usa o mesmo perfil (como o Suporte já funciona);
-- sala com 2+ equipes usa reserva por equipe (como a antiga Sala
-- Compartilhada). Se um dia o Suporte passar a dividir a sala com outra
-- equipe (ou o Sistemas ganhar uma sala só dele), basta mudar a lista de
-- equipes da sala — sem mexer em código.
-- =====================================================================

SET search_path TO "escala_ti";

CREATE TABLE IF NOT EXISTS "escala_ti"."salas" (
  cd_sala   SERIAL PRIMARY KEY,
  nm_sala   VARCHAR(100) NOT NULL,
  ds_imagem VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS "escala_ti"."sala_equipes" (
  cd_sala   INTEGER NOT NULL REFERENCES "escala_ti"."salas" (cd_sala) ON DELETE CASCADE,
  cd_equipe INTEGER NOT NULL REFERENCES "escala_ti"."equipes" (cd_equipe) ON DELETE CASCADE,
  CONSTRAINT pk_sala_equipes PRIMARY KEY (cd_sala, cd_equipe)
);

CREATE TABLE IF NOT EXISTS "escala_ti"."sala_baias" (
  cd_sala          INTEGER NOT NULL REFERENCES "escala_ti"."salas" (cd_sala) ON DELETE CASCADE,
  nr_baia          INTEGER NOT NULL,
  cd_equipe        INTEGER REFERENCES "escala_ti"."equipes" (cd_equipe) ON DELETE SET NULL,
  tp_perfil        VARCHAR(50),
  tp_especialidade VARCHAR(100),
  CONSTRAINT pk_sala_baias PRIMARY KEY (cd_sala, nr_baia)
);

-- Sala do Suporte, já com a imagem que já existe hoje.
INSERT INTO "escala_ti"."salas" (nm_sala, ds_imagem)
SELECT 'Sala Suporte', '/images/mapa-baias.png'
WHERE NOT EXISTS (SELECT 1 FROM "escala_ti"."salas" WHERE nm_sala = 'Sala Suporte');

INSERT INTO "escala_ti"."sala_equipes" (cd_sala, cd_equipe)
SELECT s.cd_sala, e.cd_equipe
FROM "escala_ti"."salas" s, "escala_ti"."equipes" e
WHERE s.nm_sala = 'Sala Suporte' AND e.tp_equipe = 'suporte'
ON CONFLICT DO NOTHING;

-- Sala compartilhada (Infra/Sistemas/Projetos), sem imagem ainda.
INSERT INTO "escala_ti"."salas" (nm_sala, ds_imagem)
SELECT 'Sala Compartilhada', NULL
WHERE NOT EXISTS (SELECT 1 FROM "escala_ti"."salas" WHERE nm_sala = 'Sala Compartilhada');

INSERT INTO "escala_ti"."sala_equipes" (cd_sala, cd_equipe)
SELECT s.cd_sala, e.cd_equipe
FROM "escala_ti"."salas" s, "escala_ti"."equipes" e
WHERE s.nm_sala = 'Sala Compartilhada' AND e.tp_equipe IN ('infraestrutura', 'sistemas', 'projetos')
ON CONFLICT DO NOTHING;

-- Migra o que já estava configurado na tela antiga "Configurar Baias"
-- (tabela baias_config, das migrações 011/012), se ela existir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'escala_ti' AND table_name = 'baias_config') THEN
    INSERT INTO "escala_ti"."sala_baias" (cd_sala, nr_baia, cd_equipe, tp_perfil)
    SELECT s.cd_sala, bc.nr_baia, bc.cd_equipe, bc.tp_perfil
    FROM "escala_ti"."baias_config" bc, "escala_ti"."salas" s
    WHERE s.nm_sala = 'Sala Suporte'
    ON CONFLICT (cd_sala, nr_baia) DO UPDATE
      SET cd_equipe = EXCLUDED.cd_equipe, tp_perfil = EXCLUDED.tp_perfil;
    DROP TABLE "escala_ti"."baias_config";
  END IF;
END $$;

-- Migra o que já estava configurado na tela antiga "Sala Compartilhada"
-- (tabela baias_compartilhadas, da migração 014 que existiu por pouco
-- tempo), se ela existir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'escala_ti' AND table_name = 'baias_compartilhadas') THEN
    INSERT INTO "escala_ti"."sala_baias" (cd_sala, nr_baia, cd_equipe, tp_especialidade)
    SELECT s.cd_sala, bc.nr_baia, bc.cd_equipe, bc.tp_especialidade
    FROM "escala_ti"."baias_compartilhadas" bc, "escala_ti"."salas" s
    WHERE s.nm_sala = 'Sala Compartilhada'
    ON CONFLICT (cd_sala, nr_baia) DO UPDATE
      SET cd_equipe = EXCLUDED.cd_equipe, tp_especialidade = EXCLUDED.tp_especialidade;
    DROP TABLE "escala_ti"."baias_compartilhadas";
  END IF;
END $$;
