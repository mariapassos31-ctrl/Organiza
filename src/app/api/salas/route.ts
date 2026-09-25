import { mensagemDeErro } from '@/lib/erros'
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

  const { rows: salasRows } = await query('SELECT cd_sala, nm_sala, ds_imagem, md5(ds_imagem_dados) as ds_imagem_hash, qtd_baias, ds_posicoes, ds_marcadores, cd_grupo_rodizio FROM salas ORDER BY cd_sala')
  const { rows: equipesRows } = await query(
    `SELECT se.cd_sala, e.tp_equipe FROM sala_equipes se JOIN equipes e ON e.cd_equipe = se.cd_equipe`
  )
  const { rows: baiasRows } = await query(
    `SELECT sb.cd_sala, sb.nr_baia, sb.tp_perfil, sb.tp_especialidade, e.tp_equipe
     FROM sala_baias sb LEFT JOIN equipes e ON e.cd_equipe = sb.cd_equipe
     ORDER BY sb.nr_baia`
  )
  const { rows: gruposRows } = await query(
    `SELECT g.cd_grupo, g.nm_grupo, s.cd_sala FROM grupos_rodizio_salas g JOIN salas s ON s.cd_grupo_rodizio = g.cd_grupo`
  )

  // Só conta como "Entre Salas" de verdade quando o grupo tem 2+ salas —
  // um grupo com uma sala só (ex: a outra foi excluída) não faz rodízio
  // nenhum, então volta a se comportar como sala comum.
  const salasPorGrupo = new Map<number, number[]>()
  for (const g of gruposRows) {
    const lista = salasPorGrupo.get(g.cd_grupo) || []
    lista.push(g.cd_sala)
    salasPorGrupo.set(g.cd_grupo, lista)
  }

  const salas = salasRows.map(s => {
    const equipesDaSala = equipesRows.filter(r => r.cd_sala === s.cd_sala).map(r => r.tp_equipe)
    const salasDoGrupo = s.cd_grupo_rodizio ? salasPorGrupo.get(s.cd_grupo_rodizio) : undefined
    const entreSalas = Boolean(salasDoGrupo && salasDoGrupo.length > 1)
    const modoReserva = entreSalas ? 'entre_salas' : (equipesDaSala.length > 1 ? 'equipe' : 'perfil')
    const baias: Record<string, unknown> = {}
    for (const b of baiasRows.filter(r => r.cd_sala === s.cd_sala)) {
      baias[String(b.nr_baia)] = modoReserva === 'perfil'
        ? { perfil: b.tp_perfil }
        : { equipe: b.tp_equipe, especialidade: b.tp_especialidade }
    }
    const grupoRow = entreSalas ? gruposRows.find(g => g.cd_grupo === s.cd_grupo_rodizio) : undefined
    return {
      id: s.cd_sala,
      nome: s.nm_sala,
      imagem: s.ds_imagem,
      imagemHash: s.ds_imagem_hash,
      qtdBaias: s.qtd_baias,
      equipes: equipesDaSala,
      modoReserva,
      podeEditar: souGestao && (minhaRole === 'admin' || equipesDaSala.includes(minhaEquipe)),
      baias,
      posicoes: s.ds_posicoes || {},
      marcadores: s.ds_marcadores || [],
      grupoRodizio: entreSalas && grupoRow ? { id: grupoRow.cd_grupo, nome: grupoRow.nm_grupo, salaIds: salasDoGrupo as number[] } : null,
    }
  })

  return NextResponse.json({ salas })
}

// Cria uma sala nova. Qualquer gestão pode escolher as equipes — não-admin
// só precisa incluir a própria equipe entre as escolhidas (mesma regra já
// usada pra editar equipes de uma sala existente).
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
    const { nome, qtdBaias } = body
    let { equipes } = body

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Dê um nome pra sala' }, { status: 400 })
    }
    const quantidade = Number(qtdBaias)
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) {
      return NextResponse.json({ error: 'Quantidade de baias inválida' }, { status: 400 })
    }
    if (!Array.isArray(equipes) || equipes.length === 0) {
      equipes = minhaEquipe ? [minhaEquipe] : []
    }
    if (equipes.length === 0) {
      return NextResponse.json({ error: 'Escolha pelo menos uma equipe' }, { status: 400 })
    }
    if (minhaRole !== 'admin' && !equipes.includes(minhaEquipe)) {
      return NextResponse.json({ error: 'Sua equipe precisa estar entre as equipes dessa sala' }, { status: 403 })
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
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
