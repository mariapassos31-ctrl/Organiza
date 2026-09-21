import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
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
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { rows } = await query(SELECT_ESCALAS)
  return NextResponse.json(rows.map(toApiShape))
}

// A criação de escalas hoje passa inteiramente por /api/escalas/auto (o
// assistente "Nova Escala"). Não existe mais formulário manual chamando
// POST aqui — esse handler foi removido porque tinha validação fraca
// (aceitava técnico de outra equipe, confiava em criadoPorUid vindo do
// cliente) e ficaria como uma porta destrancada sem uso real.
