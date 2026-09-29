import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool, equipeIdFromSlug, tecnicoIdsFromUids } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const { id } = await params

  // Fallback: se a session não trouxer equipe, busca no banco
  let userEquipe = sessionEquipe
  if (role !== 'admin' && !userEquipe) {
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
    `SELECT eq.tp_equipe, u.cd_usuario AS tecnico_usuario_id
     FROM escalas es
     JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
     LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE es.cd_escala = $1`,
    [id]
  )
  if (escalaRows.length === 0) {
    return NextResponse.json({ error: 'Escala não encontrada' }, { status: 404 })
  }
  if (role !== 'admin' && escalaRows[0].tp_equipe !== userEquipe) {
    return NextResponse.json(
      { error: 'Você só pode editar escalas da sua equipe' },
      { status: 403 }
    )
  }
  // Líder participa do rodízio normal — não edita a própria escala
  // diretamente, só pode solicitar troca com um colega (igual técnico).
  if (role === 'lider' && escalaRows.some(r => String(r.tecnico_usuario_id) === String(session.user.id))) {
    return NextResponse.json({ error: 'Você não pode editar a própria escala — solicite uma troca' }, { status: 403 })
  }

  const body = await request.json()
  const { tipo, dataInicio, dataFim, tecnicos, equipe, descricao, status, salaId } = body

  if (!tipo || !dataInicio || !dataFim || !equipe) {
    return NextResponse.json({ error: 'Tipo, período e equipe são obrigatórios' }, { status: 400 })
  }
  if (dataFim < dataInicio) {
    return NextResponse.json({ error: 'A data final não pode ser antes da data inicial' }, { status: 400 })
  }
  if (role !== 'admin' && equipe !== userEquipe) {
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

  // Sala é opcional (só faz sentido pra equipe que participa de um
  // rodízio "Entre Salas") — se vier, precisa ser uma sala que essa
  // equipe realmente usa, senão a ocupação da sala fica inconsistente.
  let cdSala: number | null = null
  if (salaId !== undefined && salaId !== null && salaId !== '') {
    const { rows: salaRows } = await query(
      `SELECT 1 FROM sala_equipes WHERE cd_sala = $1 AND cd_equipe = $2`,
      [Number(salaId), equipeId]
    )
    if (salaRows.length === 0) {
      return NextResponse.json({ error: 'Essa sala não é usada por essa equipe' }, { status: 400 })
    }
    cdSala = Number(salaId)
  }

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE escalas
       SET tp_escala = $1, cd_equipe = $2, dt_inicio = $3, dt_fim = $4, ds_descricao = $5, tp_status = $6, cd_sala = $7
       WHERE cd_escala = $8`,
      [tipo, equipeId, dataInicio, dataFim, descricao || null, status || 'ativa', cdSala, id]
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
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  } finally {
    client.release()
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}
const { role, equipe: sessionEquipe } = session.user
if (!ehPerfilGestao(role)) {
  return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
}
try {
  const { id } = await params

  // Fallback: se a session não trouxer equipe, busca no banco
  let userEquipe = sessionEquipe
  if (role !== 'admin' && !userEquipe) {
    const { rows: userRows } = await query(
      `SELECT e.tp_equipe FROM usuarios u
       JOIN equipes e ON e.cd_equipe = u.cd_equipe
       WHERE u.cd_usuario = $1`,
      [session.user.id]
    )
    userEquipe = userRows[0]?.tp_equipe || null
  }

  if (role !== 'admin') {
    const { rows } = await query(
      `SELECT eq.tp_equipe, u.cd_usuario AS tecnico_usuario_id
       FROM escalas es
       JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
       LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
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
    if (role === 'lider' && rows.some(r => String(r.tecnico_usuario_id) === String(session.user.id))) {
      return NextResponse.json({ error: 'Você não pode excluir a própria escala' }, { status: 403 })
    }
  }
  await query('DELETE FROM escalas WHERE cd_escala = $1', [id])
  return NextResponse.json({ ok: true })
} catch (error) {
  return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
}
}
