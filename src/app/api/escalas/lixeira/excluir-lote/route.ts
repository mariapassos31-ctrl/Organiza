import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'

// Apaga definitivamente várias escalas da lixeira de uma vez, mesma ideia do
// excluir-lote normal — uma consulta só em vez de uma requisição por item.
export async function POST(request: Request) {
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

    // Só considera quem já está mesmo na lixeira — e, pra não-admin, só da
    // própria equipe, sem líder mexendo na própria escala (mesma regra do
    // apagar único).
    const { rows } = await query(
      `SELECT es.cd_escala, eq.tp_equipe,
              bool_or(u.cd_usuario::text = $2) AS eh_minha
       FROM escalas es
       JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
       LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE es.cd_escala = ANY($1::int[]) AND es.tp_status = 'cancelada'
       GROUP BY es.cd_escala, eq.tp_equipe`,
      [ids, String(meuId)]
    )
    const idsParaApagar = rows
      .filter(r => role === 'admin' || (r.tp_equipe === userEquipe && !(role === 'lider' && r.eh_minha)))
      .map(r => r.cd_escala)

    if (idsParaApagar.length === 0) {
      return NextResponse.json({ apagadas: 0, falhas: ids.length })
    }

    await query(`DELETE FROM escalas WHERE cd_escala = ANY($1::int[])`, [idsParaApagar])

    return NextResponse.json({ apagadas: idsParaApagar.length, falhas: ids.length - idsParaApagar.length })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
