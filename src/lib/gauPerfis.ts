import 'server-only'
import { Pool } from 'pg'

// Gestor geral (vê tudo, como admin): ADM + um dos perfis de topo do Argos
// (N3 ou Gestor), conferidos entre os perfis da pessoa NO SISTEMA (código
// SISTEMA_GAU). Provisório — apagar quando o acesso passar a ser governado
// por perfis próprios do Escala TI.
export const PERFIS_GESTOR_GERAL_OBRIGATORIOS = ['ADM']
export const PERFIS_GESTOR_GERAL_UM_DE = ['ARG_N3', 'ARG_GESTOR']

// Código do Escala TI no GAU (SIST_ID ou SIST_CODIGO). Provisório: fixo em 10,
// dá pra trocar por GAU_SISTEMA no .env.local.
export const SISTEMA_GAU = process.env.GAU_SISTEMA || '10'

export interface IdentidadeGau {
  perfis: string[]
  // Só os perfis que a pessoa tem no sistema SISTEMA_GAU (Escala TI).
  perfisSistema: string[]
  emails: string[]
  logins: string[]
  matriculas: string[]
  nome: string | null
}

const VAZIA: IdentidadeGau = { perfis: [], perfisSistema: [], emails: [], logins: [], matriculas: [], nome: null }

// O GAU fica em outro servidor (não é o mesmo banco do escala_ti), então
// tem conexão própria, configurada por GAU_DATABASE_* no .env.local.
let poolGau: Pool | undefined

function obterPoolGau(): Pool | null {
  const { GAU_DATABASE_HOST, GAU_DATABASE_USER, GAU_DATABASE_PASSWORD } = process.env
  if (!GAU_DATABASE_HOST || !GAU_DATABASE_USER || !GAU_DATABASE_PASSWORD) return null

  if (!poolGau) {
    poolGau = new Pool({
      host: GAU_DATABASE_HOST,
      port: Number(process.env.GAU_DATABASE_PORT || 5432),
      database: process.env.GAU_DATABASE_NAME || 'db_acesso_unificado',
      user: GAU_DATABASE_USER,
      password: GAU_DATABASE_PASSWORD,
      max: 3,
      connectionTimeoutMillis: 5000,
    })
  }
  return poolGau
}

function schemaGau(): string {
  const schema = process.env.GAU_DATABASE_SCHEMA || 'db_acesso_unificado'
  return /^[A-Za-z0-9_]+$/.test(schema) ? schema : 'db_acesso_unificado'
}

// Mesma cadeia que o Argos usa (PerfilAcessoService): FUNCIONARIO ->
// FUNCIONARIO_SISTEMA_LOGIN -> LOGIN_PERFIL -> PERFIL, tudo no schema
// db_acesso_unificado. `candidatos` são login/e-mail/matrícula em minúsculas.
// Se o banco negar acesso (ou qualquer erro), devolve vazio: ninguém é
// elevado e o login segue normal pelo cadastro local.
export async function consultarGau(candidatos: string[]): Promise<IdentidadeGau> {
  if (candidatos.length === 0) return VAZIA

  const pool = obterPoolGau()
  if (!pool) {
    console.warn('[gau] GAU_DATABASE_* não configurado no .env.local — perfis do GAU ignorados')
    return VAZIA
  }
  const schema = schemaGau()

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT
              trim(p."PERF_CODIGO") AS perfil,
              COALESCE(fsl."SIST_ID"::text = $2 OR trim(s."SIST_CODIGO") = $2, false) AS do_sistema,
              lower(trim(f."FUNC_EMAIL")) AS email,
              lower(trim(f."FUNC_LOGIN_AD")) AS login,
              lower(trim(f."FUNC_MATRICULA")) AS matricula,
              trim(f."FUNC_NOME") AS nome
       FROM ${schema}."FUNCIONARIO" f
       LEFT JOIN ${schema}."FUNCIONARIO_SISTEMA_LOGIN" fsl
         ON fsl."FUNC_ID" = f."FUNC_ID" AND COALESCE(fsl."FUSL_ATIVO", 1) = 1 AND COALESCE(fsl."FUSL_EXCLUIDO", 0) = 0
       LEFT JOIN ${schema}."SISTEMA" s ON s."SIST_ID" = fsl."SIST_ID"
       LEFT JOIN ${schema}."LOGIN_PERFIL" lp
         ON lp."FUSL_ID" = fsl."FUSL_ID" AND COALESCE(lp."LOPE_ATIVO", 1) = 1 AND COALESCE(lp."LOPE_EXCLUIDO", 0) = 0
       LEFT JOIN ${schema}."PERFIL" p
         ON p."PERF_ID" = lp."PERF_ID" AND COALESCE(p."PERF_ATIVO", 1) = 1 AND COALESCE(p."PERF_EXCLUIDO", 0) = 0
       WHERE COALESCE(f."FUNC_ATIVO", 1) = 1 AND COALESCE(f."FUNC_EXCLUIDO", 0) = 0
         AND (lower(trim(f."FUNC_LOGIN_AD")) = ANY($1::text[])
              OR lower(trim(f."FUNC_EMAIL")) = ANY($1::text[])
              OR lower(trim(f."FUNC_MATRICULA")) = ANY($1::text[]))`,
      [candidatos, SISTEMA_GAU]
    )

    const unicos = (valores: Array<string | null>) => [...new Set(valores.filter((v): v is string => Boolean(v)))]
    return {
      perfis: unicos(rows.map(r => r.perfil)),
      perfisSistema: unicos(rows.filter(r => r.do_sistema).map(r => r.perfil)),
      emails: unicos(rows.map(r => r.email)),
      logins: unicos(rows.map(r => r.login)),
      matriculas: unicos(rows.map(r => r.matricula)),
      nome: rows.find(r => r.nome)?.nome ?? null,
    }
  } catch (error) {
    console.warn('[gau] não foi possível ler os perfis do GAU:', error instanceof Error ? error.message : error)
    return VAZIA
  }
}

export function ehGestorGeral(perfisSistema: string[]): boolean {
  return PERFIS_GESTOR_GERAL_OBRIGATORIOS.every(perfil => perfisSistema.includes(perfil)) &&
    PERFIS_GESTOR_GERAL_UM_DE.some(perfil => perfisSistema.includes(perfil))
}
