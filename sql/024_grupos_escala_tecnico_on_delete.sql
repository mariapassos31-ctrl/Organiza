-- cd_ultimo_tecnico só guarda "quem pegou o último bloco do rodízio" pra
-- saber quem vem a seguir — não é uma referência obrigatória (o código já
-- trata esse campo vazio como "recomeça do início", ver indiceContinuacao
-- em src/lib/escalasRodizio.ts). Sem ON DELETE SET NULL, excluir um
-- técnico que já apareceu nesse campo travava com erro de FK.
ALTER TABLE "escala_ti"."grupos_escala"
  DROP CONSTRAINT fk_grupos_escala_tecnicos;

ALTER TABLE "escala_ti"."grupos_escala"
  ADD CONSTRAINT fk_grupos_escala_tecnicos FOREIGN KEY (cd_ultimo_tecnico)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico) ON DELETE SET NULL;
