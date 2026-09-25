import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../../../lib/salasConfig'

// Muda quais equipes usam uma sala. Quem já é de uma equipe que usa essa
// sala pode mexer nela (convidar outra equipe pra dividir, ou tirar
// alguém) — é decisão de quem já está lá dentro. Admin pode mexer em
// qualquer sala. O modo de reserva (por perfil ou por equipe) da sala
// muda sozinho, só de olhar quantas equipes ficam vinculadas depois.
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

    if (minhaRole !== 'admin') {
      const { rows: equipesAtuaisRows } = await query(
        `SELECT e.tp_equipe FROM sala_equipes se JOIN equipes e ON e.cd_equipe = se.cd_equipe WHERE se.cd_sala = $1`,
        [cdSala]
      )
      if (!equipesAtuaisRows.some(r => r.tp_equipe === minhaEquipe)) {
        return NextResponse.json({ error: 'Você só pode mudar as equipes de uma sala que a sua equipe já usa' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { equipes } = body

    if (!Array.isArray(equipes) || equipes.length === 0) {
      return NextResponse.json({ error: 'Escolha pelo menos uma equipe' }, { status: 400 })
    }

    // Sala com a imagem de posições fixas (feita pra 1 equipe só, com
    // perfis específicos dela) não pode virar "por equipe" — travaria o
    // mapa visual numa lógica que ele não entende.
    const { rows: salaRows } = await query('SELECT ds_imagem FROM salas WHERE cd_sala = $1', [cdSala])
    if (salaRows[0]?.ds_imagem === IMAGEM_COM_POSICOES_CONHECIDAS && equipes.length > 1) {
      return NextResponse.json({ error: 'Essa sala usa um mapa com posições fixas — só pode ter uma equipe vinculada' }, { status: 400 })
    }

    const equipeIds = []
    for (const slug of equipes) {
      const equipeId = await equipeIdFromSlug(slug)
      if (!equipeId) {
        return NextResponse.json({ error: `Equipe "${slug}" não encontrada` }, { status: 404 })
      }
      equipeIds.push(equipeId)
    }

    await query('DELETE FROM sala_equipes WHERE cd_sala = $1', [cdSala])
    for (const equipeId of equipeIds) {
      await query(
        'INSERT INTO sala_equipes (cd_sala, cd_equipe) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [cdSala, equipeId]
      )
    }

    // Limpa reivindicações de baias de equipes que saíram da sala — senão
    // ficam presas lá, referenciando uma equipe que nem usa mais o lugar.
    await query(
      'DELETE FROM sala_baias WHERE cd_sala = $1 AND cd_equipe IS NOT NULL AND cd_equipe != ALL($2::int[])',
      [cdSala, equipeIds]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
