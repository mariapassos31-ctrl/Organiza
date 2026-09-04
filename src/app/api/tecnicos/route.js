import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const equipeSlug = searchParams.get('equipe')

  const params = []
  let sql = `
    SELECT u.cd_usuario AS uid, t.nm_tecnico, t.ds_email, t.nr_telefone,
           t.ds_especialidade, t.sn_disponivel, e.tp_equipe
    FROM tecnicos t
    JOIN usuarios u ON u.cd_usuario = t.cd_usuario
    LEFT JOIN equipes e ON e.cd_equipe = t.cd_equipe
    WHERE t.sn_ativo = true
  `

  if (equipeSlug) {
    params.push(equipeSlug)
    sql += ` AND e.tp_equipe = $${params.length}`
  }

  sql += ' ORDER BY t.nm_tecnico'

  const { rows } = await query(sql, params)

  return NextResponse.json(rows.map(row => ({
    id: String(row.uid),
    nome: row.nm_tecnico,
    email: row.ds_email,
    telefone: row.nr_telefone != null ? String(row.nr_telefone) : '',
    especialidade: row.ds_especialidade,
    disponivel: row.sn_disponivel,
    equipe: row.tp_equipe || null,
  })))
}
