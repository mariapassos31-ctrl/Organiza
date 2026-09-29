import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'

// Só quem já é de uma equipe que usa a sala pode editar/excluir ela
// (ou admin, que pode qualquer uma).
async function souDaSalaOuAdmin(cdSala: string | number, minhaRole: string, minhaEquipe: string | null | undefined) {
  if (minhaRole === 'admin') return true
  const { rows } = await query(
    `SELECT 1 FROM sala_equipes se JOIN equipes e ON e.cd_equipe = se.cd_equipe WHERE se.cd_sala = $1 AND e.tp_equipe = $2`,
    [cdSala, minhaEquipe]
  )
  return rows.length > 0
}

// Edita nome e/ou quantidade de baias de uma sala. A imagem tem endpoint
// próprio (/api/salas/[id]/imagem — upload de verdade, não um texto).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: 'Você só pode editar uma sala que a sua equipe já usa' }, { status: 403 })
    }

    const body = await request.json()
    const { nome, qtdBaias } = body

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Dê um nome pra sala' }, { status: 400 })
    }
    const quantidade = Number(qtdBaias)
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) {
      return NextResponse.json({ error: 'Quantidade de baias inválida' }, { status: 400 })
    }

    await query(
      'UPDATE salas SET nm_sala = $1, qtd_baias = $2 WHERE cd_sala = $3',
      [nome.trim(), quantidade, cdSala]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}

// Exclui uma sala (junto com as equipes e baias vinculadas a ela).
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
      return NextResponse.json({ error: 'Você só pode excluir uma sala que a sua equipe já usa' }, { status: 403 })
    }

    await query('DELETE FROM salas WHERE cd_sala = $1', [cdSala])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
