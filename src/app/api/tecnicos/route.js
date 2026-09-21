import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { auth } from '../../../auth'

// Traz dados sensíveis (matrícula, especialidade, horário, baia, férias) —
// só usado hoje pela tela de Relatórios, que é admin/gestor. Um gestor só
// pode ver a própria equipe, mesmo que peça outra via query string.
export async function GET(request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe } = session.user
  if (role !== 'admin' && role !== 'gestor') {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  let userEquipe = sessionEquipe
  if (role === 'gestor' && !userEquipe) {
    const { rows } = await query(
      `SELECT e.tp_equipe FROM usuarios u
       JOIN equipes e ON e.cd_equipe = u.cd_equipe
       WHERE u.cd_usuario = $1`,
      [session.user.id]
    )
    userEquipe = rows[0]?.tp_equipe || null
  }

  const { searchParams } = new URL(request.url)
  const equipeSlug = role === 'gestor' ? userEquipe : searchParams.get('equipe')

  const params = []
  let sql = `
    SELECT u.cd_usuario AS uid, t.nm_tecnico, t.ds_email, t.nr_telefone,
           t.ds_especialidade, t.sn_disponivel, e.tp_equipe, u.ds_matricula,
           t.hr_entrada, t.nr_baia,
           to_char(t.dt_ferias_inicio, 'YYYY-MM-DD') AS dt_ferias_inicio,
           to_char(t.dt_ferias_fim, 'YYYY-MM-DD') AS dt_ferias_fim
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
    matricula: row.ds_matricula || '',
    disponivel: row.sn_disponivel,
    equipe: row.tp_equipe || null,
    horarioEntrada: row.hr_entrada ? String(row.hr_entrada).slice(0, 5) : '',
    baia: row.nr_baia != null ? String(row.nr_baia) : '',
    feriasInicio: row.dt_ferias_inicio || '',
    feriasFim: row.dt_ferias_fim || '',
  })))
}
