import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'

const TAMANHO_MAXIMO = 5 * 1024 * 1024 // 5MB — planta baixa é uma imagem simples, não precisa de mais que isso.

async function souDaSalaOuAdmin(cdSala: string | number, minhaRole: string, minhaEquipe: string | null | undefined) {
  if (minhaRole === 'admin') return true
  const { rows } = await query(
    `SELECT 1 FROM sala_equipes se JOIN equipes e ON e.cd_equipe = se.cd_equipe WHERE se.cd_sala = $1 AND e.tp_equipe = $2`,
    [cdSala, minhaEquipe]
  )
  return rows.length > 0
}

// Serve a imagem guardada no banco — é o que "ds_imagem" aponta pra sala
// depois de um upload, então o <img src={sala.imagem}> funciona igual a
// uma imagem estática normal.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse(null, { status: 401 })
  }

  const { id } = await params
  const { rows } = await query(
    'SELECT ds_imagem_dados, ds_imagem_tipo FROM salas WHERE cd_sala = $1',
    [Number(id)]
  )
  const row = rows[0]
  if (!row?.ds_imagem_dados) {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(row.ds_imagem_dados, {
    headers: {
      'Content-Type': row.ds_imagem_tipo || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

// Recebe o upload da imagem e já aponta "ds_imagem" pra esse endpoint.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (!ehPerfilGestao(minhaRole)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const { id } = await params
    const cdSala = Number(id)
    if (!(await souDaSalaOuAdmin(cdSala, minhaRole, minhaEquipe))) {
      return NextResponse.json({ error: 'Você só pode enviar imagem pra uma sala que a sua equipe já usa' }, { status: 403 })
    }

    const formData = await request.formData()
    const arquivo = formData.get('imagem')
    if (!arquivo || typeof arquivo === 'string') {
      return NextResponse.json({ error: 'Envie um arquivo de imagem' }, { status: 400 })
    }
    if (!arquivo.type?.startsWith('image/')) {
      return NextResponse.json({ error: 'O arquivo precisa ser uma imagem' }, { status: 400 })
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json({ error: 'Imagem muito grande (máximo 5MB)' }, { status: 400 })
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer())
    const url = `/api/salas/${cdSala}/imagem`

    // Uma imagem nova pode ter um layout bem diferente da anterior — as
    // posições de baia e os marcadores (divisória, rack etc.) calibrados
    // pra planta antiga não fazem mais sentido.
    await query(
      'UPDATE salas SET ds_imagem_dados = $1, ds_imagem_tipo = $2, ds_imagem = $3, ds_posicoes = NULL, ds_marcadores = NULL WHERE cd_sala = $4',
      [bytes, arquivo.type, url, cdSala]
    )

    return NextResponse.json({ ok: true, imagem: url })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}

// Remove a imagem da sala (volta a virar lista simples).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (!ehPerfilGestao(minhaRole)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const { id } = await params
    const cdSala = Number(id)
    if (!(await souDaSalaOuAdmin(cdSala, minhaRole, minhaEquipe))) {
      return NextResponse.json({ error: 'Você só pode remover a imagem de uma sala que a sua equipe já usa' }, { status: 403 })
    }

    await query(
      'UPDATE salas SET ds_imagem_dados = NULL, ds_imagem_tipo = NULL, ds_imagem = NULL, ds_posicoes = NULL, ds_marcadores = NULL WHERE cd_sala = $1',
      [cdSala]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
