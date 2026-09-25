import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'

async function souDaSalaOuAdmin(cdSala: string | number, minhaRole: string, minhaEquipe: string | null | undefined) {
  if (minhaRole === 'admin') return true
  const { rows } = await query(
    `SELECT 1 FROM sala_equipes se JOIN equipes e ON e.cd_equipe = se.cd_equipe WHERE se.cd_sala = $1 AND e.tp_equipe = $2`,
    [cdSala, minhaEquipe]
  )
  return rows.length > 0
}

function posicaoValida(valor: unknown): valor is { top: string; left: string } {
  if (!valor || typeof valor !== 'object') return false
  const { top, left } = valor as Record<string, unknown>
  return typeof top === 'string' && typeof left === 'string'
}

// Marca onde cada baia fica desenhada na planta da sala (em % da imagem) —
// o mesmo conceito que já existia fixo no código pra planta do Suporte,
// só que aqui é configurável pela tela pra qualquer sala com imagem própria.
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
      return NextResponse.json({ error: 'Você só pode ajustar a planta de uma sala que a sua equipe já usa' }, { status: 403 })
    }

    const { rows: salaRows } = await query('SELECT qtd_baias FROM salas WHERE cd_sala = $1', [cdSala])
    if (salaRows.length === 0) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }
    const qtdBaias = salaRows[0].qtd_baias

    const body = await request.json()
    const { posicoes } = body
    if (!posicoes || typeof posicoes !== 'object' || Array.isArray(posicoes)) {
      return NextResponse.json({ error: 'Posições inválidas' }, { status: 400 })
    }

    const validadas: Record<string, { top: string; left: string }> = {}
    for (const [baia, posicao] of Object.entries(posicoes)) {
      const numero = Number(baia)
      if (!Number.isInteger(numero) || numero < 1 || numero > qtdBaias) {
        return NextResponse.json({ error: `Baia ${baia} inválida` }, { status: 400 })
      }
      if (!posicaoValida(posicao)) {
        return NextResponse.json({ error: `Posição da baia ${baia} inválida` }, { status: 400 })
      }
      validadas[baia] = { top: posicao.top, left: posicao.left }
    }

    await query('UPDATE salas SET ds_posicoes = $1 WHERE cd_sala = $2', [JSON.stringify(validadas), cdSala])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
