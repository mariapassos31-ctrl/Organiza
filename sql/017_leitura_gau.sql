-- =====================================================================
-- Escala TI - leitura dos perfis do GAU (db_acesso_unificado)
-- O login unificado consulta quem tem os perfis ADM + (ARG_N3 ou ARG_GESTOR) (mesma cadeia
-- usada pelo Argos) pra liberar a visão de gestor geral. Precisa ser
-- executado por um usuário dono desses objetos. Só leitura, e só as colunas
-- usadas em FUNCIONARIO. Rodar no servidor do GAU (172.16.0.2), trocando
-- <usuario_gau_leitura> pelo usuário configurado em GAU_DATABASE_USER.
-- =====================================================================

GRANT USAGE ON SCHEMA db_acesso_unificado TO <usuario_gau_leitura>;

GRANT SELECT ("FUNC_ID", "FUNC_NOME", "FUNC_LOGIN_AD", "FUNC_EMAIL", "FUNC_MATRICULA", "FUNC_ATIVO", "FUNC_EXCLUIDO")
  ON db_acesso_unificado."FUNCIONARIO" TO <usuario_gau_leitura>;

GRANT SELECT ON db_acesso_unificado."FUNCIONARIO_SISTEMA_LOGIN" TO <usuario_gau_leitura>;
GRANT SELECT ON db_acesso_unificado."LOGIN_PERFIL" TO <usuario_gau_leitura>;
GRANT SELECT ON db_acesso_unificado."PERFIL" TO <usuario_gau_leitura>;

GRANT SELECT ("SIST_ID", "SIST_CODIGO") ON db_acesso_unificado."SISTEMA" TO <usuario_gau_leitura>;
