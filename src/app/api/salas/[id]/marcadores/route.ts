import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'

const TIPOS_VALIDOS = ['divisoria', 'rack', 'impressora', 'outro']
const ROTULO_MAXIMO = 40

async function souDaSalaOuAdmin(cdSala: string | number, minhaRole: string, minhaEquipe: string | null | undefined) {
  if (minhaRole === 'admin') return true
  const { rows } = await query(
    `SELECT 1 FROM sala_equipes se JOIN equipes e ON e.cd_equipe = se.cd_equipe WHERE se.cd_sala = $1 AND e.tp_equipe = $2`,
    [cdSala, minhaEquipe]
  )
  return rows.length > 0
}

interface MarcadorRecebido {
  id?: unknown
  tipo?: unknown
  rotulo?: unknown
  top?: unknown
  left?: unknown
}

// Itens de referência na planta (divisória, rack, impressora, ou um rótulo
// livre) — só decoram o mapa visual da sala, não são baia e não entram em
// reserva nenhuma.
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

    const body = await request.json()
    const { marcadores } = body
    if (!Array.isArray(marcadores)) {
      return NextResponse.json({ error: 'Marcadores inválidos' }, { status: 400 })
    }

    const validados = marcadores.map((m: MarcadorRecebido) => {
      if (
        typeof m.id !== 'string' || !m.id ||
        typeof m.tipo !== 'string' || !TIPOS_VALIDOS.includes(m.tipo) ||
        typeof m.rotulo !== 'string' || !m.rotulo.trim() ||
        typeof m.top !== 'string' || typeof m.left !== 'string'
      ) {
        throw new Error('Item da planta inválido')
      }
      return { id: m.id, tipo: m.tipo, rotulo: m.rotulo.trim().slice(0, ROTULO_MAXIMO), top: m.top, left: m.left }
    })

    await query('UPDATE salas SET ds_marcadores = $1 WHERE cd_sala = $2', [JSON.stringify(validados), cdSala])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
