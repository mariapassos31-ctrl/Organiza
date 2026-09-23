import { NextResponse } from 'next/server'
import { getPool } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { montarPlano, resolverEquipeGestor } from '../../../../lib/escalasAuto'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'

export async function POST(request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const userEquipe = role !== 'admin' ? await resolverEquipeGestor(session.user) : null
  const body = await request.json()

  try {
    const plano = await montarPlano({ role, userEquipe, body })
    if (plano.error) {
      return NextResponse.json({ error: plano.error }, { status: plano.status })
    }

    const client = await getPool().connect()
    const criadas = []
    try {
      await client.query('BEGIN')
      for (const b of plano.blocos) {
        const { rows } = await client.query(
          `INSERT INTO escalas (tp_escala, cd_equipe, dt_inicio, dt_fim, ds_descricao, tp_status, cd_usuario_criador)
           VALUES ($1, $2, $3, $4, $5, 'ativa', $6)
           RETURNING cd_escala`,
          [b.tipo, plano.equipeId, b.dtInicio, b.dtFim, 'Gerada automaticamente', Number(session.user.id)]
        )
        const escalaId = rows[0].cd_escala
        await client.query('INSERT INTO escala_tecnicos (cd_escala, cd_tecnico) VALUES ($1, $2)', [escalaId, b.cdTecnico])
        criadas.push(escalaId)
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ criadas: criadas.length }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
