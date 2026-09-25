import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../../lib/salasConfig'

async function souDoGrupoOuAdmin(cdGrupo: number, minhaRole: string, minhaEquipe: string | null | undefined) {
  if (minhaRole === 'admin') return true
  const { rows } = await query(
    `SELECT 1 FROM salas s JOIN sala_equipes se ON se.cd_sala = s.cd_sala JOIN equipes e ON e.cd_equipe = se.cd_equipe
     WHERE s.cd_grupo_rodizio = $1 AND e.tp_equipe = $2 LIMIT 1`,
    [cdGrupo, minhaEquipe]
  )
  return rows.length > 0
}

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
    const cdGrupo = Number(id)
    const { rows: grupoRows } = await query('SELECT cd_grupo FROM grupos_rodizio_salas WHERE cd_grupo = $1', [cdGrupo])
    if (grupoRows.length === 0) {
      return NextResponse.json({ error: 'Rodízio não encontrado' }, { status: 404 })
    }
    if (!(await souDoGrupoOuAdmin(cdGrupo, minhaRole, minhaEquipe))) {
      return NextResponse.json({ error: 'Você só pode editar um rodízio que a sua equipe já participa' }, { status: 403 })
    }

    const body = await request.json()
    const { nome, salaIds, equipes } = body

    if (nome !== undefined) {
      if (!String(nome).trim()) {
        return NextResponse.json({ error: 'Dê um nome pro rodízio' }, { status: 400 })
      }
      await query('UPDATE grupos_rodizio_salas SET nm_grupo = $1 WHERE cd_grupo = $2', [String(nome).trim(), cdGrupo])
    }

    if (salaIds !== undefined) {
      if (!Array.isArray(salaIds) || salaIds.length < 2) {
        return NextResponse.json({ error: 'Escolha pelo menos 2 salas' }, { status: 400 })
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
        return NextResponse.json({ error: 'Uma dessas salas usa o mapa com posições fixas — não entra em rodízio entre salas' }, { status: 400 })
      }
      if (salasRows.some(s => s.cd_grupo_rodizio && s.cd_grupo_rodizio !== cdGrupo)) {
        return NextResponse.json({ error: 'Uma dessas salas já faz parte de outro rodízio entre salas' }, { status: 400 })
      }
      // Tira do grupo quem não está mais na lista, põe quem é novo.
      await query('UPDATE salas SET cd_grupo_rodizio = NULL WHERE cd_grupo_rodizio = $1 AND cd_sala != ALL($2::int[])', [cdGrupo, idsNumericos])
      await query('UPDATE salas SET cd_grupo_rodizio = $1 WHERE cd_sala = ANY($2::int[])', [cdGrupo, idsNumericos])
    }

    if (equipes !== undefined) {
      if (!Array.isArray(equipes) || equipes.length === 0) {
        return NextResponse.json({ error: 'Escolha pelo menos uma equipe' }, { status: 400 })
      }
      if (minhaRole !== 'admin' && !equipes.includes(minhaEquipe)) {
        return NextResponse.json({ error: 'Sua equipe precisa continuar entre as equipes desse rodízio' }, { status: 403 })
      }
      const equipeIds = []
      for (const slug of equipes) {
        const equipeId = await equipeIdFromSlug(slug)
        if (!equipeId) {
          return NextResponse.json({ error: `Equipe "${slug}" não encontrada` }, { status: 404 })
        }
        equipeIds.push(equipeId)
      }
      const { rows: membrosRows } = await query('SELECT cd_sala FROM salas WHERE cd_grupo_rodizio = $1', [cdGrupo])
      for (const membro of membrosRows) {
        await query('DELETE FROM sala_equipes WHERE cd_sala = $1', [membro.cd_sala])
        for (const equipeId of equipeIds) {
          await query('INSERT INTO sala_equipes (cd_sala, cd_equipe) VALUES ($1, $2) ON CONFLICT DO NOTHING', [membro.cd_sala, equipeId])
        }
        await query(
          'DELETE FROM sala_baias WHERE cd_sala = $1 AND cd_equipe IS NOT NULL AND cd_equipe != ALL($2::int[])',
          [membro.cd_sala, equipeIds]
        )
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}

// Dissolve o grupo — as salas voltam a ser independentes (mantêm as
// equipes que já tinham, param só de fazer rodízio entre si). Escalas já
// geradas mantêm a sala que ficou gravada nelas, como histórico.
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
    const cdGrupo = Number(id)
    if (!(await souDoGrupoOuAdmin(cdGrupo, minhaRole, minhaEquipe))) {
      return NextResponse.json({ error: 'Você só pode desfazer um rodízio que a sua equipe já participa' }, { status: 403 })
    }
    await query('UPDATE salas SET cd_grupo_rodizio = NULL WHERE cd_grupo_rodizio = $1', [cdGrupo])
    await query('DELETE FROM grupos_rodizio_salas WHERE cd_grupo = $1', [cdGrupo])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
