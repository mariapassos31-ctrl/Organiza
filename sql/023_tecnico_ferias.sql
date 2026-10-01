-- Vários períodos de férias por técnico (o campo único em
-- tecnicos.dt_ferias_inicio/dt_ferias_fim só guarda um período — fica
-- mantido como está, pra quem ainda edita manualmente na tela de
-- Usuários). Essa tabela é a fonte pra importações em lote (Excel hoje,
-- TOTVS depois) onde a mesma pessoa pode ter mais de um período no ano.
CREATE TABLE IF NOT EXISTS "escala_ti"."tecnico_ferias" (
  cd_ferias  SERIAL PRIMARY KEY,
  cd_tecnico INTEGER NOT NULL REFERENCES "escala_ti"."tecnicos" (cd_tecnico) ON DELETE CASCADE,
  dt_inicio  DATE NOT NULL,
  dt_fim     DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tecnico_ferias_cd_tecnico ON "escala_ti"."tecnico_ferias" (cd_tecnico);
