import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../lib/db'
import { auth } from '../../../auth'
import { ehPerfilGestao } from '../../../lib/equipesConfig'

// Quais baias (por equipe) são exclusivas de qual perfil. Qualquer
// colaborador autenticado pode ler (o mapa da sala é compartilhado com todo
// mundo), mas só quem tem perfil de gestão pode mudar, e só na própria equipe.
export async function GET(request) {
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
    'SELECT nr_baia, tp_perfil FROM baias_config WHERE cd_equipe = $1 ORDER BY nr_baia',
    [equipeId]
  )
  const baias = {}
  for (const r of rows) baias[String(r.nr_baia)] = r.tp_perfil

  return NextResponse.json({ baias })
}

export async function PATCH(request) {
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
    const { baia, perfil } = body
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

    const numero = Number(baia)
    if (!Number.isInteger(numero) || numero < 0 || numero > 9) {
      return NextResponse.json({ error: 'Número da baia inválido' }, { status: 400 })
    }

    if (!perfil) {
      await query('DELETE FROM baias_config WHERE cd_equipe = $1 AND nr_baia = $2', [equipeId, numero])
    } else {
      // "supervisor" só pode estar em uma baia por vez — marcar uma nova
      // desmarca automaticamente qualquer outra que já tivesse essa baia.
      if (perfil === 'supervisor') {
        await query(
          'DELETE FROM baias_config WHERE cd_equipe = $1 AND tp_perfil = $2 AND nr_baia != $3',
          [equipeId, 'supervisor', numero]
        )
      }
      await query(
        `INSERT INTO baias_config (cd_equipe, nr_baia, tp_perfil)
         VALUES ($1, $2, $3)
         ON CONFLICT (cd_equipe, nr_baia) DO UPDATE SET tp_perfil = EXCLUDED.tp_perfil`,
        [equipeId, numero, perfil]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
