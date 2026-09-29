-- =====================================================================
-- Escala TI - baias por perfil (generaliza o "sn_aprendiz" da migração
-- 011 pra aceitar qualquer perfil, não só Estag/Aprendiz). E migra quem
-- hoje tem especialidade "Aprendiz"/"Estagiário" pro novo perfil próprio
-- "estagiario_aprendiz".
-- =====================================================================

SET search_path TO "escala_ti";

ALTER TABLE "escala_ti"."baias_config" ADD COLUMN IF NOT EXISTS tp_perfil VARCHAR(50);

-- Migra o que já existia no formato antigo (sn_aprendiz true/false) pro
-- novo: "true" vira o perfil equivalente; "false" só existia porque alguém
-- desmarcou uma baia, e nesse formato novo isso é só a ausência da linha
-- (sem restrição), então a linha é removida.
UPDATE "escala_ti"."baias_config" SET tp_perfil = 'estagiario_aprendiz' WHERE sn_aprendiz = true;
DELETE FROM "escala_ti"."baias_config" WHERE sn_aprendiz = false;

ALTER TABLE "escala_ti"."baias_config" DROP COLUMN IF EXISTS sn_aprendiz;
ALTER TABLE "escala_ti"."baias_config" ALTER COLUMN tp_perfil SET NOT NULL;

-- "Aprendiz" e "Estagiário" deixam de ser especialidade (dentro do perfil
-- Técnico) e viram o perfil próprio "estagiario_aprendiz" — some da
-- especialidade e o perfil passa a valer isso.
UPDATE "escala_ti"."usuarios"
SET tp_role = 'estagiario_aprendiz'
WHERE cd_usuario IN (
  SELECT cd_usuario FROM "escala_ti"."tecnicos"
  WHERE ds_especialidade IN ('Aprendiz', 'Estagiário')
);

UPDATE "escala_ti"."tecnicos"
SET ds_especialidade = NULL
WHERE ds_especialidade IN ('Aprendiz', 'Estagiário');
