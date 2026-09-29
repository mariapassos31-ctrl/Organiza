import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../lib/db'
import { auth } from '../../../auth'
import { ehPerfilGestao } from '../../../lib/equipesConfig'

// Quem é o responsável fixo do Laboratório e quem é o backup (cobre o
// posto quando o responsável estiver de home office). Qualquer
// colaborador autenticado pode ler (o mapa do dia depende disso pra
// mostrar quem está lá), mas só quem tem perfil de gestão pode mudar, e
// só na própria equipe.
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const equipeSlug = searchParams.get('equipe')
  if (!equipeSlug) {
    return NextResponse.json({ error: 'Equipe é obrigatória' }, { status: 400 })
  }
  const equipeId = await equipeIdFromSlug(equipeSlug)
  if (!equipeId) {
    return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 })
  }

  const { rows } = await query(
    'SELECT cd_usuario_responsavel, cd_usuario_backup FROM laboratorio_config WHERE cd_equipe = $1',
    [equipeId]
  )
  const row = rows[0]

  return NextResponse.json({
    responsavelUid: row?.cd_usuario_responsavel != null ? String(row.cd_usuario_responsavel) : null,
    backupUid: row?.cd_usuario_backup != null ? String(row.cd_usuario_backup) : null,
  })
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (!ehPerfilGestao(minhaRole)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { responsavelUid, backupUid } = body
    let { equipe } = body

    if (minhaRole !== 'admin') {
      equipe = minhaEquipe
    }
    if (!equipe) {
      return NextResponse.json({ error: 'Equipe é obrigatória' }, { status: 400 })
    }
    const equipeId = await equipeIdFromSlug(equipe)
    if (!equipeId) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 })
    }
    if (responsavelUid && backupUid && responsavelUid === backupUid) {
      return NextResponse.json({ error: 'O responsável e o backup não podem ser a mesma pessoa' }, { status: 400 })
    }

    await query(
      `INSERT INTO laboratorio_config (cd_equipe, cd_usuario_responsavel, cd_usuario_backup)
       VALUES ($1, $2, $3)
       ON CONFLICT (cd_equipe) DO UPDATE SET
         cd_usuario_responsavel = EXCLUDED.cd_usuario_responsavel,
         cd_usuario_backup = EXCLUDED.cd_usuario_backup`,
      [equipeId, responsavelUid ? Number(responsavelUid) : null, backupUid ? Number(backupUid) : null]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
