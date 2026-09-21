import { NextResponse } from 'next/server'
import { query, getPool, equipeIdFromSlug, tecnicoIdsFromUids } from '../../../../lib/db'
import { auth } from '../../../../auth'


export async function PATCH(request, { params }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe } = session.user
  if (role !== 'admin' && role !== 'gestor') {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const { id } = await params

  // Fallback: se a session não trouxer equipe, busca no banco
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

  // Validações que só leem dados usam o helper simples — a transação só é
  // aberta depois, quando já se sabe que a escrita vai de fato acontecer.
  const { rows: escalaRows } = await query(
    `SELECT eq.tp_equipe FROM escalas es
     JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
     WHERE es.cd_escala = $1`,
    [id]
  )
  if (escalaRows.length === 0) {
    return NextResponse.json({ error: 'Escala não encontrada' }, { status: 404 })
  }
  if (role === 'gestor' && escalaRows[0].tp_equipe !== userEquipe) {
    return NextResponse.json(
      { error: 'Você só pode editar escalas da sua equipe' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { tipo, dataInicio, dataFim, tecnicos, equipe, descricao, status } = body

  if (!tipo || !dataInicio || !dataFim || !equipe) {
    return NextResponse.json({ error: 'Tipo, período e equipe são obrigatórios' }, { status: 400 })
  }
  if (dataFim < dataInicio) {
    return NextResponse.json({ error: 'A data final não pode ser antes da data inicial' }, { status: 400 })
  }
  if (role === 'gestor' && equipe !== userEquipe) {
    return NextResponse.json(
      { error: 'Você não pode transferir escala para outra equipe' },
      { status: 403 }
    )
  }
  if (tipo === 'sabado' && equipe !== 'suporte') {
    return NextResponse.json(
      { error: 'Escala do tipo Sábado só pode ser usada pela equipe Suporte' },
      { status: 400 }
    )
  }

  const equipeId = await equipeIdFromSlug(equipe)
  if (!equipeId) {
    return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 })
  }

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE escalas
       SET tp_escala = $1, cd_equipe = $2, dt_inicio = $3, dt_fim = $4, ds_descricao = $5, tp_status = $6
       WHERE cd_escala = $7`,
      [tipo, equipeId, dataInicio, dataFim, descricao || null, status || 'ativa', id]
    )

    await client.query('DELETE FROM escala_tecnicos WHERE cd_escala = $1', [id])

    // Escopado pela equipe da escala: um uid de outra equipe é ignorado em
    // vez de ser injetado aqui.
    const tecnicoIds = await tecnicoIdsFromUids(Array.isArray(tecnicos) ? tecnicos : [], equipeId)
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
const { role, equipe: sessionEquipe } = session.user
if (role !== 'admin' && role !== 'gestor') {
  return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
}
try {
  const { id } = await params

  // Fallback: se a session não trouxer equipe, busca no banco
  let userEquipe = sessionEquipe
  if (role === 'gestor' && !userEquipe) {
    const { rows: userRows } = await query(
      `SELECT e.tp_equipe FROM usuarios u
       JOIN equipes e ON e.cd_equipe = u.cd_equipe
       WHERE u.cd_usuario = $1`,
      [session.user.id]
    )
    userEquipe = userRows[0]?.tp_equipe || null
  }

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
