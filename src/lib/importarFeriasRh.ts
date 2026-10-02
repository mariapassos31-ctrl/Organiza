import 'server-only'
import { query, getPool } from './db'
import { buscarFeriasTiRh } from './rhFerias'

export interface ItemFeriasRh {
  chapa: string
  nomeRh: string
  time: string
  cargo: string
  dataInicio: string
  dataFim: string
  nroDiasFerias: number
  tecnico: { cdTecnico: number; uid: string; nome: string } | null
  jaCadastrado: boolean
}

function normalizarMatricula(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '')
}

// Prévia: quem o RM diz que está de férias agora, casado com o cadastro
// local (ds_matricula) — quem não bate com nenhum técnico ativo fica com
// tecnico: null e é ignorado na importação.
export async function prevImportacaoFeriasRh(): Promise<ItemFeriasRh[]> {
  const feriasRh = await buscarFeriasTiRh()

  const { rows: tecnicos } = await query<{ cd_tecnico: number; cd_usuario: number; nm_tecnico: string; ds_matricula: string | null }>(
    `SELECT t.cd_tecnico, t.cd_usuario, t.nm_tecnico, u.ds_matricula
     FROM tecnicos t
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE t.sn_ativo = true AND u.ds_matricula IS NOT NULL AND u.ds_matricula <> ''`
  )
  const porMatricula = new Map(tecnicos.map(t => [normalizarMatricula(t.ds_matricula), t]))

  const { rows: existentes } = await query<{ cd_tecnico: number; dt_inicio: string; dt_fim: string }>(
    `SELECT cd_tecnico, to_char(dt_inicio, 'YYYY-MM-DD') AS dt_inicio, to_char(dt_fim, 'YYYY-MM-DD') AS dt_fim
     FROM tecnico_ferias`
  )
  const existeSet = new Set(existentes.map(e => `${e.cd_tecnico}|${e.dt_inicio}|${e.dt_fim}`))

  return feriasRh.map(f => {
    const tecnico = porMatricula.get(normalizarMatricula(f.chapa)) ?? null
    const jaCadastrado = tecnico ? existeSet.has(`${tecnico.cd_tecnico}|${f.dataInicio}|${f.dataFim}`) : false
    return {
      chapa: f.chapa,
      nomeRh: f.nome,
      time: f.time,
      cargo: f.cargo,
      dataInicio: f.dataInicio,
      dataFim: f.dataFim,
      nroDiasFerias: f.nroDiasFerias,
      tecnico: tecnico ? { cdTecnico: tecnico.cd_tecnico, uid: String(tecnico.cd_usuario), nome: tecnico.nm_tecnico } : null,
      jaCadastrado,
    }
  })
}

// Aplica: grava em tecnico_ferias todo período casado com um técnico local
// que ainda não estava cadastrado. Idempotente (ver
// sql/025_tecnico_ferias_unique.sql) — rodar de novo não duplica.
export async function aplicarImportacaoFeriasRh(): Promise<{ importados: number }> {
  const itens = (await prevImportacaoFeriasRh()).filter(i => i.tecnico && !i.jaCadastrado)
  if (itens.length === 0) return { importados: 0 }

  const client = await getPool().connect()
  let importados = 0
  try {
    await client.query('BEGIN')
    for (const item of itens) {
      const { rowCount } = await client.query(
        `INSERT INTO tecnico_ferias (cd_tecnico, dt_inicio, dt_fim)
         VALUES ($1, $2, $3)
         ON CONFLICT (cd_tecnico, dt_inicio, dt_fim) DO NOTHING`,
        [item.tecnico!.cdTecnico, item.dataInicio, item.dataFim]
      )
      importados += rowCount ?? 0
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return { importados }
}
