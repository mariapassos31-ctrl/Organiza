import { NextResponse } from 'next/server'
import { query, getPool, equipeIdFromSlug, tecnicoIdsFromUids } from '../../../../lib/db'

export async function PATCH(request, { params }) {
  const client = await getPool().connect()
  try {
    const { id } = await params
    const body = await request.json()
    const { tipo, dataInicio, dataFim, tecnicos, equipe, descricao, status } = body

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
  try {
    const { id } = await params
    await query('DELETE FROM escalas WHERE cd_escala = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
