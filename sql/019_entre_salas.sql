-- =====================================================================
-- Escala TI - "Entre Salas": grupo de 2+ salas onde as pessoas das
-- equipes selecionadas fazem rodízio real entre os ambientes (não só
-- dividem baias numa sala só, como a Sala Compartilhada). Qual sala cada
-- escala pertence fica gravado na própria escala (cd_sala) — só é
-- preenchido quando o rodízio entre salas é gerado pra aquele período;
-- pras equipes fora desse modo, continua NULL e a sala é descoberta como
-- sempre (pela equipe).
-- =====================================================================

SET search_path TO "escala_ti";

CREATE TABLE IF NOT EXISTS "escala_ti"."grupos_rodizio_salas" (
  cd_grupo SERIAL PRIMARY KEY,
  nm_grupo VARCHAR(100) NOT NULL
);

ALTER TABLE "escala_ti"."salas"
  ADD COLUMN IF NOT EXISTS cd_grupo_rodizio INTEGER REFERENCES "escala_ti"."grupos_rodizio_salas" (cd_grupo) ON DELETE SET NULL;

ALTER TABLE "escala_ti"."escalas"
  ADD COLUMN IF NOT EXISTS cd_sala INTEGER REFERENCES "escala_ti"."salas" (cd_sala) ON DELETE SET NULL;
