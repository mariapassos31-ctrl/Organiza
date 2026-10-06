import 'server-only'
import { Pool } from 'pg'

// Código do Escala TI no GAU (SIST_ID ou SIST_CODIGO) — "ESCTI" (SIST_ID 14).
// Dá pra trocar por GAU_SISTEMA no .env.local se o cadastro mudar de ID.
export const SISTEMA_GAU = process.env.GAU_SISTEMA || '14'

// Perfis cadastrados no GAU pro Escala TI (tela "Perfis RBAC"), em ordem de
// prioridade — se a pessoa tiver mais de um, vale o mais alto. O papel que o
// GAU atribui manda mais que o cadastro local (ds_role): é o GAU quem decide
// quem é admin/gestor/líder/técnico/estagiário-aprendiz, o cadastro local só
// guarda a equipe (que o GAU não sabe) e os dados específicos de escala
// (baia, horário etc). "analista" e "trainee" não têm perfil próprio no GAU
// — continuam só no cadastro local (ver POST /api/usuarios).
export const PERFIS_GAU_PARA_ROLE: Array<{ perfil: string; role: string }> = [
  { perfil: 'ESCTI_ADMIN', role: 'admin' },
  { perfil: 'ESCTI_GESTOR', role: 'gestor' },
  { perfil: 'ESCTI_LIDER', role: 'lider' },
  { perfil: 'ESCTI_TECNICO', role: 'tecnico' },
  { perfil: 'ESCTI_ESTAGIARIO', role: 'estagiario_aprendiz' },
]

// Papel que os perfis do GAU, no sistema ESCTI, atribuem a essa pessoa —
// null se ela não tem nenhum desses perfis (login segue só pelo cadastro
// local, como antes do GAU).
export function papelDoGau(perfisSistema: string[]): string | null {
  return PERFIS_GAU_PARA_ROLE.find(p => perfisSistema.includes(p.perfil))?.role ?? null
}

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

export interface UsuarioGau {
  nome: string | null
  email: string | null
  login: string | null
  matricula: string | null
  // Perfis ESCTI que essa pessoa tem — mesma fonte de papelDoGau().
  perfis: string[]
}

// Todo mundo que tem QUALQUER um dos perfis ESCTI_* no GAU (sistema
// SISTEMA_GAU), ativo — é a lista "quem deveria ter acesso ao Escala TI
// segundo o GAU", usada pra tela de Usuários casar com o cadastro local.
export async function listarUsuariosGau(): Promise<UsuarioGau[]> {
  const pool = obterPoolGau()
  if (!pool) {
    console.warn('[gau] GAU_DATABASE_* não configurado no .env.local — lista de usuários do GAU ignorada')
    return []
  }
  const schema = schemaGau()
  const perfisEscti = PERFIS_GAU_PARA_ROLE.map(p => p.perfil)

  try {
    const { rows } = await pool.query(
      `SELECT f."FUNC_ID",
              trim(f."FUNC_NOME") AS nome,
              lower(trim(f."FUNC_EMAIL")) AS email,
              lower(trim(f."FUNC_LOGIN_AD")) AS login,
              lower(trim(f."FUNC_MATRICULA")) AS matricula,
              trim(p."PERF_CODIGO") AS perfil
       FROM ${schema}."FUNCIONARIO" f
       JOIN ${schema}."FUNCIONARIO_SISTEMA_LOGIN" fsl
         ON fsl."FUNC_ID" = f."FUNC_ID" AND COALESCE(fsl."FUSL_ATIVO", 1) = 1 AND COALESCE(fsl."FUSL_EXCLUIDO", 0) = 0
       JOIN ${schema}."SISTEMA" s
         ON s."SIST_ID" = fsl."SIST_ID" AND (s."SIST_ID"::text = $1 OR trim(s."SIST_CODIGO") = $1)
       JOIN ${schema}."LOGIN_PERFIL" lp
         ON lp."FUSL_ID" = fsl."FUSL_ID" AND COALESCE(lp."LOPE_ATIVO", 1) = 1 AND COALESCE(lp."LOPE_EXCLUIDO", 0) = 0
       JOIN ${schema}."PERFIL" p
         ON p."PERF_ID" = lp."PERF_ID" AND COALESCE(p."PERF_ATIVO", 1) = 1 AND COALESCE(p."PERF_EXCLUIDO", 0) = 0
             AND trim(p."PERF_CODIGO") = ANY($2::text[])
       WHERE COALESCE(f."FUNC_ATIVO", 1) = 1 AND COALESCE(f."FUNC_EXCLUIDO", 0) = 0`,
      [SISTEMA_GAU, perfisEscti]
    )

    const porFuncId = new Map<number, UsuarioGau>()
    for (const r of rows) {
      const atual: UsuarioGau = porFuncId.get(r.FUNC_ID) ?? { nome: r.nome, email: r.email, login: r.login, matricula: r.matricula, perfis: [] }
      if (r.perfil && !atual.perfis.includes(r.perfil)) atual.perfis.push(r.perfil)
      porFuncId.set(r.FUNC_ID, atual)
    }
    return [...porFuncId.values()]
  } catch (error) {
    console.warn('[gau] não foi possível listar usuários do GAU:', error instanceof Error ? error.message : error)
    return []
  }
}
