import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../lib/db'
import { auth } from '../../../auth'
import { ehPerfilGestao } from '../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'

// "Entre Salas": um grupo de 2+ salas onde as pessoas das equipes
// selecionadas fazem rodízio de verdade entre os ambientes (dia a dia
// muda quem senta em qual sala, não só divide baias numa sala só).
// Qualquer gestão pode criar — mas só incluindo a própria equipe entre as
// escolhidas (mexer só em equipes alheias continua sendo coisa de admin).
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { rows: gruposRows } = await query('SELECT cd_grupo, nm_grupo FROM grupos_rodizio_salas ORDER BY cd_grupo')
  const { rows: salasRows } = await query(
    `SELECT cd_grupo_rodizio, cd_sala, nm_sala FROM salas WHERE cd_grupo_rodizio IS NOT NULL ORDER BY cd_sala`
  )
  const { rows: equipesRows } = await query(
    `SELECT s.cd_grupo_rodizio, e.tp_equipe FROM sala_equipes se
     JOIN salas s ON s.cd_sala = se.cd_sala
     JOIN equipes e ON e.cd_equipe = se.cd_equipe
     WHERE s.cd_grupo_rodizio IS NOT NULL`
  )

  const grupos = gruposRows.map(g => ({
    id: g.cd_grupo,
    nome: g.nm_grupo,
    salas: salasRows.filter(s => s.cd_grupo_rodizio === g.cd_grupo).map(s => ({ id: s.cd_sala, nome: s.nm_sala })),
    equipes: [...new Set(equipesRows.filter(e => e.cd_grupo_rodizio === g.cd_grupo).map(e => e.tp_equipe))],
  }))

  return NextResponse.json({ grupos })
}

export async function POST(request: Request) {
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
    const { nome, salaIds, equipes } = body

    if (!nome || !String(nome).trim()) {
      return NextResponse.json({ error: 'Dê um nome pro rodízio' }, { status: 400 })
    }
    if (!Array.isArray(salaIds) || salaIds.length < 2) {
      return NextResponse.json({ error: 'Escolha pelo menos 2 salas' }, { status: 400 })
    }
    if (!Array.isArray(equipes) || equipes.length === 0) {
      return NextResponse.json({ error: 'Escolha pelo menos uma equipe' }, { status: 400 })
    }
    if (minhaRole !== 'admin' && !equipes.includes(minhaEquipe)) {
      return NextResponse.json({ error: 'Sua equipe precisa estar entre as equipes desse rodízio' }, { status: 403 })
    }

    const idsNumericos = salaIds.map(Number)
    const { rows: salasRows } = await query(
      'SELECT cd_sala, ds_imagem, cd_grupo_rodizio FROM salas WHERE cd_sala = ANY($1::int[])',
      [idsNumericos]
    )
    if (salasRows.length !== idsNumericos.length) {
      return NextResponse.json({ error: 'Uma das salas escolhidas não existe' }, { status: 404 })
    }
    if (salasRows.some(s => s.ds_imagem === IMAGEM_COM_POSICOES_CONHECIDAS)) {
      return NextResponse.json({ error: 'Uma dessas salas usa o mapa com posições fixas — ela só pode ter uma equipe e não entra em rodízio entre salas' }, { status: 400 })
    }
    if (salasRows.some(s => s.cd_grupo_rodizio)) {
      return NextResponse.json({ error: 'Uma dessas salas já faz parte de outro rodízio entre salas — tire ela de lá primeiro' }, { status: 400 })
    }

    const equipeIds = []
    for (const slug of equipes) {
      const equipeId = await equipeIdFromSlug(slug)
      if (!equipeId) {
        return NextResponse.json({ error: `Equipe "${slug}" não encontrada` }, { status: 404 })
      }
      equipeIds.push(equipeId)
    }

    const { rows: grupoRows } = await query(
      'INSERT INTO grupos_rodizio_salas (nm_grupo) VALUES ($1) RETURNING cd_grupo',
      [String(nome).trim()]
    )
    const cdGrupo = grupoRows[0].cd_grupo

    for (const salaId of idsNumericos) {
      await query('UPDATE salas SET cd_grupo_rodizio = $1 WHERE cd_sala = $2', [cdGrupo, salaId])
      await query('DELETE FROM sala_equipes WHERE cd_sala = $1', [salaId])
      for (const equipeId of equipeIds) {
        await query('INSERT INTO sala_equipes (cd_sala, cd_equipe) VALUES ($1, $2) ON CONFLICT DO NOTHING', [salaId, equipeId])
      }
      // Baias reivindicadas por uma equipe que não entrou no grupo ficam
      // presas apontando pra ninguém — libera.
      await query(
        'DELETE FROM sala_baias WHERE cd_sala = $1 AND cd_equipe IS NOT NULL AND cd_equipe != ALL($2::int[])',
        [salaId, equipeIds]
      )
    }

    return NextResponse.json({ ok: true, id: cdGrupo }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
