import { NextResponse } from 'next/server'
import { query, getPool, equipeIdFromSlug, tecnicoIdsFromUids } from '../../../lib/db'
import { auth } from '../../../auth'

const SELECT_ESCALAS = `
  SELECT es.cd_escala,
         es.tp_escala,
         to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
         to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
         es.ds_descricao,
         es.tp_status,
         es.dt_criacao,
         eq.tp_equipe,
         cu.nm_usuario AS criado_por_nome,
         COALESCE(
           json_agg(u.cd_usuario::text) FILTER (WHERE u.cd_usuario IS NOT NULL),
           '[]'
         ) AS tecnico_uids
  FROM escalas es
  LEFT JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
  LEFT JOIN usuarios cu ON cu.cd_usuario = es.cd_usuario_criador
  LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
  LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
  LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
  GROUP BY es.cd_escala, eq.tp_equipe, cu.nm_usuario
  ORDER BY es.dt_inicio DESC
`

function toApiShape(row) {
  return {
    id: String(row.cd_escala),
    tipo: row.tp_escala,
    dataInicio: row.dt_inicio,
    dataFim: row.dt_fim,
    tecnicos: row.tecnico_uids || [],
    equipe: row.tp_equipe || null,
    descricao: row.ds_descricao,
    status: row.tp_status,
    criadoPor: row.criado_por_nome,
    dataCriacao: row.dt_criacao,
  }
}

export async function GET() {
  const { rows } = await query(SELECT_ESCALAS)
  return NextResponse.json(rows.map(toApiShape))
}

export async function POST(request) {
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}
const { role, equipe: userEquipe } = session.user
if (role !== 'admin' && role !== 'gestor') {
  return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
}
const body = await request.json()
const { tipo, dataInicio, dataFim, tecnicos, equipe, descricao, status, criadoPorUid } = body
if (role === 'gestor' && equipe !== userEquipe) {
  return NextResponse.json(
    { error: 'Você só pode criar escalas para sua equipe' },
    { status: 403 }
  )
}
const client = await getPool().connect()
try {

    await client.query('BEGIN')

    const equipeId = await equipeIdFromSlug(equipe)
    const criadoPorId = criadoPorUid ? Number(criadoPorUid) : null

    const { rows } = await client.query(
      `INSERT INTO escalas (tp_escala, cd_equipe, dt_inicio, dt_fim, ds_descricao, tp_status, cd_usuario_criador)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING cd_escala`,
      [tipo, equipeId, dataInicio, dataFim, descricao || null, status || 'ativa', criadoPorId]
    )
    const escalaId = rows[0].cd_escala

    const tecnicoIds = await tecnicoIdsFromUids(Array.isArray(tecnicos) ? tecnicos : [])
    for (const cdTecnico of tecnicoIds) {
      await client.query(
        'INSERT INTO escala_tecnicos (cd_escala, cd_tecnico) VALUES ($1, $2)',
        [escalaId, cdTecnico]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ id: String(escalaId) }, { status: 201 })
  } catch (error) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: error.message }, { status: 400 })
  } finally {
    client.release()
  }
}
