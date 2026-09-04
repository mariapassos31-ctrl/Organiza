-- =====================================================================
-- Escala TI - schema de tabelas (PostgreSQL)
-- Padronizado conforme "Padrão de Nomenclatura Postgres"
-- Schema: escala_ti
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS "escala_ti";
SET search_path TO "escala_ti";

-- ---------------------------------------------------------------------
-- Função utilitária para manter dt_atualizacao em dia
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "escala_ti".fn_atualiza_dt_atualizacao()
RETURNS trigger AS $$
BEGIN
  NEW.dt_atualizacao = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- equipes
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."equipes_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."equipes" (
  cd_equipe      INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."equipes_seq"'),
  tp_equipe      VARCHAR(50) NOT NULL,     -- slug: suporte | infraestrutura | sistemas | analista
  nm_equipe      VARCHAR(100) NOT NULL,
  ds_cor         VARCHAR(20),
  sn_ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  dt_criacao     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_equipes_tp_equipe UNIQUE (tp_equipe)
);

INSERT INTO "escala_ti"."equipes" (tp_equipe, nm_equipe, ds_cor) VALUES
  ('suporte',        '🎧 Suporte',        '#3498db'),
  ('infraestrutura', '🔧 Infraestrutura', '#e74c3c'),
  ('sistemas',       '💻 Sistemas',       '#27ae60'),
  ('analista',       '📊 Analista',       '#9b59b6')
ON CONFLICT (tp_equipe) DO NOTHING;

-- ---------------------------------------------------------------------
-- usuarios (contas do app; autenticação real fica no Firebase Auth)
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."usuarios_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."usuarios" (
  cd_usuario       INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."usuarios_seq"'),
  ds_firebase_uid  VARCHAR(128) NOT NULL,
  nm_usuario       VARCHAR(150) NOT NULL,
  ds_email         VARCHAR(150) NOT NULL,
  tp_role          VARCHAR(20) NOT NULL,
  cd_equipe        INTEGER,
  sn_ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  dt_criacao       TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_usuarios_ds_firebase_uid UNIQUE (ds_firebase_uid),
  CONSTRAINT uq_usuarios_ds_email UNIQUE (ds_email),
  CONSTRAINT ck_usuarios_tp_role CHECK (tp_role IN ('admin', 'gestor', 'tecnico', 'analista')),
  CONSTRAINT fk_usuarios_equipes FOREIGN KEY (cd_equipe)
    REFERENCES "escala_ti"."equipes" (cd_equipe)
);

CREATE TRIGGER trg_usuarios_dt_atualizacao
  BEFORE UPDATE ON "escala_ti"."usuarios"
  FOR EACH ROW EXECUTE FUNCTION "escala_ti".fn_atualiza_dt_atualizacao();

CREATE INDEX idx_usuarios_cd_equipe ON "escala_ti"."usuarios" (cd_equipe);
CREATE INDEX idx_usuarios_tp_role ON "escala_ti"."usuarios" (tp_role);

-- ---------------------------------------------------------------------
-- tecnicos
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."tecnicos_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."tecnicos" (
  cd_tecnico       INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."tecnicos_seq"'),
  cd_usuario       INTEGER,
  nm_tecnico       VARCHAR(150) NOT NULL,
  ds_email         VARCHAR(150),
  nr_telefone      NUMERIC(15, 0),
  ds_especialidade VARCHAR(150),
  cd_equipe        INTEGER,
  sn_disponivel    BOOLEAN NOT NULL DEFAULT TRUE,
  sn_ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  dt_criacao       TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_tecnicos_cd_usuario UNIQUE (cd_usuario),
  CONSTRAINT fk_tecnicos_usuarios FOREIGN KEY (cd_usuario)
    REFERENCES "escala_ti"."usuarios" (cd_usuario) ON DELETE SET NULL,
  CONSTRAINT fk_tecnicos_equipes FOREIGN KEY (cd_equipe)
    REFERENCES "escala_ti"."equipes" (cd_equipe)
);

CREATE TRIGGER trg_tecnicos_dt_atualizacao
  BEFORE UPDATE ON "escala_ti"."tecnicos"
  FOR EACH ROW EXECUTE FUNCTION "escala_ti".fn_atualiza_dt_atualizacao();

CREATE INDEX idx_tecnicos_cd_equipe ON "escala_ti"."tecnicos" (cd_equipe);

-- ---------------------------------------------------------------------
-- grupos_escala
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."grupos_escala_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."grupos_escala" (
  cd_grupo_escala        INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."grupos_escala_seq"'),
  nm_grupo_escala        VARCHAR(150) NOT NULL,
  tp_grupo_escala        VARCHAR(20) NOT NULL,
  tp_frequencia          VARCHAR(20) NOT NULL DEFAULT 'weekly',
  cd_equipe              INTEGER,
  cd_ultimo_tecnico      INTEGER,
  dt_ultima_atribuicao   DATE,
  sn_ativo               BOOLEAN NOT NULL DEFAULT TRUE,
  dt_criacao             TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_grupos_escala_tp_grupo_escala CHECK (tp_grupo_escala IN ('presencial', 'homeoffice', 'sabado', 'sobreaviso')),
  CONSTRAINT ck_grupos_escala_tp_frequencia CHECK (tp_frequencia IN ('weekly', 'monthly', 'custom')),
  CONSTRAINT fk_grupos_escala_equipes FOREIGN KEY (cd_equipe)
    REFERENCES "escala_ti"."equipes" (cd_equipe),
  CONSTRAINT fk_grupos_escala_tecnicos FOREIGN KEY (cd_ultimo_tecnico)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico)
);

CREATE TRIGGER trg_grupos_escala_dt_atualizacao
  BEFORE UPDATE ON "escala_ti"."grupos_escala"
  FOR EACH ROW EXECUTE FUNCTION "escala_ti".fn_atualiza_dt_atualizacao();

-- ---------------------------------------------------------------------
-- escalas
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."escalas_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."escalas" (
  cd_escala          INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."escalas_seq"'),
  tp_escala          VARCHAR(20) NOT NULL,
  cd_grupo_escala    INTEGER,
  cd_equipe          INTEGER,
  dt_inicio          DATE NOT NULL,
  dt_fim             DATE NOT NULL,
  ds_descricao       VARCHAR(255),
  tp_status          VARCHAR(20) NOT NULL DEFAULT 'ativa',
  cd_usuario_criador INTEGER,
  dt_criacao         TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_escalas_tp_escala CHECK (tp_escala IN ('presencial', 'homeoffice', 'sabado', 'sobreaviso')),
  CONSTRAINT ck_escalas_tp_status CHECK (tp_status IN ('ativa', 'finalizada', 'cancelada')),
  CONSTRAINT ck_escalas_dt_fim CHECK (dt_fim >= dt_inicio),
  CONSTRAINT fk_escalas_grupos_escala FOREIGN KEY (cd_grupo_escala)
    REFERENCES "escala_ti"."grupos_escala" (cd_grupo_escala) ON DELETE SET NULL,
  CONSTRAINT fk_escalas_equipes FOREIGN KEY (cd_equipe)
    REFERENCES "escala_ti"."equipes" (cd_equipe),
  CONSTRAINT fk_escalas_usuarios FOREIGN KEY (cd_usuario_criador)
    REFERENCES "escala_ti"."usuarios" (cd_usuario)
);

CREATE TRIGGER trg_escalas_dt_atualizacao
  BEFORE UPDATE ON "escala_ti"."escalas"
  FOR EACH ROW EXECUTE FUNCTION "escala_ti".fn_atualiza_dt_atualizacao();

CREATE INDEX idx_escalas_cd_equipe ON "escala_ti"."escalas" (cd_equipe);
CREATE INDEX idx_escalas_dt_inicio_dt_fim ON "escala_ti"."escalas" (dt_inicio, dt_fim);
CREATE INDEX idx_escalas_tp_status ON "escala_ti"."escalas" (tp_status);

-- ---------------------------------------------------------------------
-- escala_tecnicos (N:N)
-- ---------------------------------------------------------------------
CREATE TABLE "escala_ti"."escala_tecnicos" (
  cd_escala   INTEGER NOT NULL,
  cd_tecnico  INTEGER NOT NULL,

  CONSTRAINT pk_escala_tecnicos PRIMARY KEY (cd_escala, cd_tecnico),
  CONSTRAINT fk_escala_tecnicos_escalas FOREIGN KEY (cd_escala)
    REFERENCES "escala_ti"."escalas" (cd_escala) ON DELETE CASCADE,
  CONSTRAINT fk_escala_tecnicos_tecnicos FOREIGN KEY (cd_tecnico)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico) ON DELETE CASCADE
);

CREATE INDEX idx_escala_tecnicos_cd_tecnico ON "escala_ti"."escala_tecnicos" (cd_tecnico);

-- ---------------------------------------------------------------------
-- indisponibilidades
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."indisponibilidades_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."indisponibilidades" (
  cd_indisponibilidade INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."indisponibilidades_seq"'),
  cd_tecnico            INTEGER NOT NULL,
  dt_inicio              DATE NOT NULL,
  dt_fim                 DATE NOT NULL,
  ds_motivo              VARCHAR(255),
  dt_criacao             TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_indisponibilidades_dt_fim CHECK (dt_fim >= dt_inicio),
  CONSTRAINT fk_indisponibilidades_tecnicos FOREIGN KEY (cd_tecnico)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico) ON DELETE CASCADE
);

CREATE TRIGGER trg_indisponibilidades_dt_atualizacao
  BEFORE UPDATE ON "escala_ti"."indisponibilidades"
  FOR EACH ROW EXECUTE FUNCTION "escala_ti".fn_atualiza_dt_atualizacao();

CREATE INDEX idx_indisponibilidades_cd_tecnico ON "escala_ti"."indisponibilidades" (cd_tecnico);

-- ---------------------------------------------------------------------
-- trocas_escala
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."trocas_escala_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."trocas_escala" (
  cd_troca_escala        INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."trocas_escala_seq"'),
  cd_escala               INTEGER NOT NULL,
  cd_tecnico_solicitante  INTEGER NOT NULL,
  cd_tecnico_destino      INTEGER,
  tp_status               VARCHAR(20) NOT NULL DEFAULT 'pendente',
  cd_tecnico_aceite       INTEGER,
  dt_aceite               TIMESTAMPTZ,
  dt_criacao              TIMESTAMPTZ NOT NULL DEFAULT now(),
  dt_atualizacao          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_trocas_escala_tp_status CHECK (tp_status IN ('pendente', 'aceita', 'recusada', 'cancelada')),
  CONSTRAINT fk_trocas_escala_escalas FOREIGN KEY (cd_escala)
    REFERENCES "escala_ti"."escalas" (cd_escala) ON DELETE CASCADE,
  CONSTRAINT fk_trocas_escala_tecnicos_solicitante FOREIGN KEY (cd_tecnico_solicitante)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico),
  CONSTRAINT fk_trocas_escala_tecnicos_destino FOREIGN KEY (cd_tecnico_destino)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico),
  CONSTRAINT fk_trocas_escala_tecnicos_aceite FOREIGN KEY (cd_tecnico_aceite)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico)
);

CREATE TRIGGER trg_trocas_escala_dt_atualizacao
  BEFORE UPDATE ON "escala_ti"."trocas_escala"
  FOR EACH ROW EXECUTE FUNCTION "escala_ti".fn_atualiza_dt_atualizacao();

CREATE INDEX idx_trocas_escala_tp_status ON "escala_ti"."trocas_escala" (tp_status);
CREATE INDEX idx_trocas_escala_cd_tecnico_solicitante ON "escala_ti"."trocas_escala" (cd_tecnico_solicitante);

-- ---------------------------------------------------------------------
-- notificacoes
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."notificacoes_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."notificacoes" (
  cd_notificacao INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."notificacoes_seq"'),
  cd_usuario     INTEGER NOT NULL,
  tp_notificacao VARCHAR(30) NOT NULL,
  nm_titulo      VARCHAR(150) NOT NULL,
  ds_mensagem    VARCHAR(500),
  sn_lida        BOOLEAN NOT NULL DEFAULT FALSE,
  cd_referencia  INTEGER,
  dt_criacao     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_notificacoes_tp_notificacao CHECK (tp_notificacao IN (
    'escala_atribuida', 'troca_solicitada', 'troca_aceita',
    'troca_recusada', 'indisponibilidade_criada'
  )),
  CONSTRAINT fk_notificacoes_usuarios FOREIGN KEY (cd_usuario)
    REFERENCES "escala_ti"."usuarios" (cd_usuario) ON DELETE CASCADE
);

CREATE INDEX idx_notificacoes_cd_usuario_sn_lida ON "escala_ti"."notificacoes" (cd_usuario, sn_lida);

-- ---------------------------------------------------------------------
-- historico_escalas (auditoria de alterações em escalas)
-- ---------------------------------------------------------------------
CREATE SEQUENCE "escala_ti"."historico_escalas_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "escala_ti"."historico_escalas" (
  cd_historico_escala   INTEGER PRIMARY KEY DEFAULT nextval('"escala_ti"."historico_escalas_seq"'),
  cd_escala              INTEGER,
  tp_alteracao           VARCHAR(20) NOT NULL,  -- criacao | edicao | exclusao | troca
  cd_tecnico_original    INTEGER,
  cd_usuario             INTEGER,
  ds_detalhes            JSONB,
  dt_criacao             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_historico_escalas_escalas FOREIGN KEY (cd_escala)
    REFERENCES "escala_ti"."escalas" (cd_escala) ON DELETE SET NULL,
  CONSTRAINT fk_historico_escalas_tecnicos FOREIGN KEY (cd_tecnico_original)
    REFERENCES "escala_ti"."tecnicos" (cd_tecnico),
  CONSTRAINT fk_historico_escalas_usuarios FOREIGN KEY (cd_usuario)
    REFERENCES "escala_ti"."usuarios" (cd_usuario)
);

CREATE INDEX idx_historico_escalas_cd_escala ON "escala_ti"."historico_escalas" (cd_escala);
CREATE INDEX idx_historico_escalas_cd_tecnico_original ON "escala_ti"."historico_escalas" (cd_tecnico_original);
