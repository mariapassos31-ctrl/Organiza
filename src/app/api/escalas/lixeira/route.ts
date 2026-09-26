import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'
import { purgarLixeiraExpirada, PRAZO_LIXEIRA_DIAS } from '../../../../lib/escalasLixeira'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApiShape(row: any) {
  const dataExclusao = new Date(row.dt_exclusao)
  const diasPassados = Math.floor((Date.now() - dataExclusao.getTime()) / 86400000)
  return {
    id: String(row.cd_escala),
    tipo: row.tp_escala,
    dataInicio: row.dt_inicio,
    dataFim: row.dt_fim,
    descricao: row.ds_descricao,
    equipe: row.tp_equipe || null,
    tecnicosNomes: row.tecnicos_nomes || [],
    dataExclusao: row.dt_exclusao,
    diasRestantes: Math.max(0, PRAZO_LIXEIRA_DIAS - diasPassados),
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe, id: userId } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    await purgarLixeiraExpirada()

    let userEquipe = sessionEquipe
    if (role !== 'admin' && !userEquipe) {
      const { rows } = await query(
        `SELECT e.tp_equipe FROM usuarios u JOIN equipes e ON e.cd_equipe = u.cd_equipe WHERE u.cd_usuario = $1`,
        [userId]
      )
      userEquipe = rows[0]?.tp_equipe || null
    }

    let sql = `
      SELECT es.cd_escala,
             es.tp_escala,
             to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
             to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
             es.ds_descricao,
             es.dt_atualizacao AS dt_exclusao,
             eq.tp_equipe,
             COALESCE(
               json_agg(u.nm_usuario) FILTER (WHERE u.nm_usuario IS NOT NULL),
               '[]'
             ) AS tecnicos_nomes
      FROM escalas es
      LEFT JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
      LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
      LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
      LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
      WHERE es.tp_status = 'cancelada'
    `
    const params: unknown[] = []
    if (role !== 'admin') {
      sql += ' AND eq.tp_equipe = $1'
      params.push(userEquipe)
    }
    sql += ' GROUP BY es.cd_escala, eq.tp_equipe ORDER BY es.dt_atualizacao DESC'

    const { rows } = await query(sql, params)
    return NextResponse.json(rows.map(toApiShape))
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}
