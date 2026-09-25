import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../lib/db'
import { auth } from '../../../auth'
import { ehPerfilGestao } from '../../../lib/equipesConfig'

// Lista as salas que existem, com quem pode usá-las e como estão
// configuradas hoje. O "modo" de reserva não é escolhido por ninguém — é
// automático: sala com 1 equipe só reserva por perfil (dessa equipe),
// sala com 2+ equipes reserva por equipe (+ especialidade opcional
// dentro dela). Qualquer colaborador autenticado pode ler; "podeEditar"
// é só uma dica pro front, a escrita real é validada de novo no PATCH.
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  const souGestao = ehPerfilGestao(minhaRole)

  const { rows: salasRows } = await query('SELECT cd_sala, nm_sala, ds_imagem, qtd_baias FROM salas ORDER BY cd_sala')
  const { rows: equipesRows } = await query(
    `SELECT se.cd_sala, e.tp_equipe FROM sala_equipes se JOIN equipes e ON e.cd_equipe = se.cd_equipe`
  )
  const { rows: baiasRows } = await query(
    `SELECT sb.cd_sala, sb.nr_baia, sb.tp_perfil, sb.tp_especialidade, e.tp_equipe
     FROM sala_baias sb LEFT JOIN equipes e ON e.cd_equipe = sb.cd_equipe
     ORDER BY sb.nr_baia`
  )

  const salas = salasRows.map(s => {
    const equipesDaSala = equipesRows.filter(r => r.cd_sala === s.cd_sala).map(r => r.tp_equipe)
    const modoReserva = equipesDaSala.length > 1 ? 'equipe' : 'perfil'
    const baias = {}
    for (const b of baiasRows.filter(r => r.cd_sala === s.cd_sala)) {
      baias[String(b.nr_baia)] = modoReserva === 'equipe'
        ? { equipe: b.tp_equipe, especialidade: b.tp_especialidade }
        : { perfil: b.tp_perfil }
    }
    return {
      id: s.cd_sala,
      nome: s.nm_sala,
      imagem: s.ds_imagem,
      qtdBaias: s.qtd_baias,
      equipes: equipesDaSala,
      modoReserva,
      podeEditar: souGestao && (minhaRole === 'admin' || equipesDaSala.includes(minhaEquipe)),
      baias,
    }
  })

  return NextResponse.json({ salas })
}

// Cria uma sala nova. Qualquer gestão pode — vira dona dela automaticamente
// (equipe forçada pra própria, exceto admin, que pode escolher).
export async function POST(request) {
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
    const { nome, qtdBaias } = body
    let { equipes } = body

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Dê um nome pra sala' }, { status: 400 })
    }
    const quantidade = Number(qtdBaias)
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) {
      return NextResponse.json({ error: 'Quantidade de baias inválida' }, { status: 400 })
    }
    if (minhaRole !== 'admin') {
      equipes = [minhaEquipe]
    }
    if (!Array.isArray(equipes) || equipes.length === 0) {
      return NextResponse.json({ error: 'Escolha pelo menos uma equipe' }, { status: 400 })
    }

    const equipeIds = []
    for (const slug of equipes) {
      const equipeId = await equipeIdFromSlug(slug)
      if (!equipeId) {
        return NextResponse.json({ error: `Equipe "${slug}" não encontrada` }, { status: 404 })
      }
      equipeIds.push(equipeId)
    }

    const { rows } = await query(
      'INSERT INTO salas (nm_sala, qtd_baias) VALUES ($1, $2) RETURNING cd_sala',
      [nome.trim(), quantidade]
    )
    const cdSala = rows[0].cd_sala
    for (const equipeId of equipeIds) {
      await query('INSERT INTO sala_equipes (cd_sala, cd_equipe) VALUES ($1, $2)', [cdSala, equipeId])
    }

    return NextResponse.json({ ok: true, id: cdSala }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
