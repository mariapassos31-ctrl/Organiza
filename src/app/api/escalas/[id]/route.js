import { NextResponse } from 'next/server'
import { query, getPool, equipeIdFromSlug, tecnicoIdsFromUids } from '../../../../lib/db'
import { auth } from '../../../../auth'


export async function PATCH(request, { params }) {
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}
const { role, equipe: userEquipe } = session.user
const { id } = await params
const client = await getPool().connect()
try {
  const { rows: escalaRows } = await client.query(
    `SELECT eq.tp_equipe FROM escalas es
     JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
     WHERE es.cd_escala = $1`,
    [id]
  )
  if (escalaRows.length === 0) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: 'Escala não encontrada' }, { status: 404 })
  }
  if (role === 'gestor' && escalaRows[0].tp_equipe !== userEquipe) {
    await client.query('ROLLBACK')
    return NextResponse.json(
      { error: 'Você só pode editar escalas da sua equipe' },
      { status: 403 }
    )
  }
  const body = await request.json()
  const { tipo, dataInicio, dataFim, tecnicos, equipe, descricao, status } = body
  if (role === 'gestor' && equipe !== userEquipe) {
    await client.query('ROLLBACK')
    return NextResponse.json(
      { error: 'Você não pode transferir escala para outra equipe' },
      { status: 403 }
    )
  }

    await client.query('BEGIN')

    const equipeId = await equipeIdFromSlug(equipe)

    await client.query(
      `UPDATE escalas
       SET tp_escala = $1, cd_equipe = $2, dt_inicio = $3, dt_fim = $4, ds_descricao = $5, tp_status = $6
       WHERE cd_escala = $7`,
      [tipo, equipeId, dataInicio, dataFim, descricao || null, status || 'ativa', id]
    )

    await client.query('DELETE FROM escala_tecnicos WHERE cd_escala = $1', [id])

    const tecnicoIds = await tecnicoIdsFromUids(Array.isArray(tecnicos) ? tecnicos : [])
    for (const cdTecnico of tecnicoIds) {
      await client.query(
        'INSERT INTO escala_tecnicos (cd_escala, cd_tecnico) VALUES ($1, $2)',
        [id, cdTecnico]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: error.message }, { status: 400 })
  } finally {
    client.release()
  }
}

export async function DELETE(_request, { params }) {
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}
const { role, equipe: userEquipe } = session.user
try {
  const { id } = await params
  if (role === 'gestor') {
    const { rows } = await query(
      `SELECT eq.tp_equipe FROM escalas es
       JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
       WHERE es.cd_escala = $1`,
      [id]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Escala não encontrada' }, { status: 404 })
    }
    if (rows[0].tp_equipe !== userEquipe) {
      return NextResponse.json(
        { error: 'Você só pode excluir escalas da sua equipe' },
        { status: 403 }
      )
    }
  }
  await query('DELETE FROM escalas WHERE cd_escala = $1', [id])
  return NextResponse.json({ ok: true })
} catch (error) {
  return NextResponse.json({ error: error.message }, { status: 400 })
}
}
