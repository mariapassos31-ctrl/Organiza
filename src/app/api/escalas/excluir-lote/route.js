import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'

// Apaga várias escalas de uma vez, numa única consulta — bem mais rápido
// que uma requisição por escala (que travava/demorava demais em lotes
// grandes, tipo 1000+ escalas selecionadas na lista detalhada).
export async function POST(request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe, id: meuId } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nenhuma escala informada' }, { status: 400 })
    }

    let userEquipe = sessionEquipe
    if (role !== 'admin' && !userEquipe) {
      const { rows } = await query(
        `SELECT e.tp_equipe FROM usuarios u JOIN equipes e ON e.cd_equipe = u.cd_equipe WHERE u.cd_usuario = $1`,
        [meuId]
      )
      userEquipe = rows[0]?.tp_equipe || null
    }

    let idsParaExcluir = ids

    // Não-admin: só pode apagar escala da própria equipe, e Líder não pode
    // apagar a própria escala (só pedir troca) — filtra em uma consulta só.
    if (role !== 'admin') {
      const { rows } = await query(
        `SELECT es.cd_escala, eq.tp_equipe,
                bool_or(u.cd_usuario::text = $2) AS eh_minha
         FROM escalas es
         JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
         LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
         LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
         LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
         WHERE es.cd_escala = ANY($1::int[])
         GROUP BY es.cd_escala, eq.tp_equipe`,
        [ids, String(meuId)]
      )
      idsParaExcluir = rows
        .filter(r => r.tp_equipe === userEquipe && !(role === 'lider' && r.eh_minha))
        .map(r => r.cd_escala)
    }

    if (idsParaExcluir.length === 0) {
      return NextResponse.json({ excluidas: 0, falhas: ids.length })
    }

    await query('DELETE FROM escalas WHERE cd_escala = ANY($1::int[])', [idsParaExcluir])

    return NextResponse.json({ excluidas: idsParaExcluir.length, falhas: ids.length - idsParaExcluir.length })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
