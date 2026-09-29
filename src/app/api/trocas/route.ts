import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { auth } from '../../../auth'

const SELECT_TROCAS = `
  SELECT te.cd_troca_escala,
         te.tp_status,
         to_char(te.dt_dia, 'YYYY-MM-DD') AS dt_dia,
         te.dt_criacao,
         te.dt_aceite,
         es.cd_escala,
         es.tp_escala,
         to_char(es.dt_inicio, 'YYYY-MM-DD') AS escala_dt_inicio,
         to_char(es.dt_fim, 'YYYY-MM-DD') AS escala_dt_fim,
         eq.tp_equipe AS equipe,
         us.cd_usuario AS solicitante_uid,
         us.nm_usuario AS solicitante_nome,
         ud.cd_usuario AS destino_uid,
         ud.nm_usuario AS destino_nome,
         esol.cd_escala AS escala_solicitada_cd,
         esol.tp_escala AS escala_solicitada_tipo,
         to_char(esol.dt_inicio, 'YYYY-MM-DD') AS escala_solicitada_dt_inicio,
         to_char(esol.dt_fim, 'YYYY-MM-DD') AS escala_solicitada_dt_fim
  FROM trocas_escala te
  JOIN escalas es ON es.cd_escala = te.cd_escala
  LEFT JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
  JOIN tecnicos ts ON ts.cd_tecnico = te.cd_tecnico_solicitante
  JOIN usuarios us ON us.cd_usuario = ts.cd_usuario
  LEFT JOIN tecnicos td ON td.cd_tecnico = te.cd_tecnico_destino
  LEFT JOIN usuarios ud ON ud.cd_usuario = td.cd_usuario
  LEFT JOIN escalas esol ON esol.cd_escala = te.cd_escala_solicitada
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApiShape(row: any) {
  return {
    id: String(row.cd_troca_escala),
    status: row.tp_status,
    dia: row.dt_dia,
    escalaId: String(row.cd_escala),
    escalaTipo: row.tp_escala,
    escalaDataInicio: row.escala_dt_inicio,
    escalaDataFim: row.escala_dt_fim,
    equipe: row.equipe,
    solicitanteUid: String(row.solicitante_uid),
    solicitanteNome: row.solicitante_nome,
    destinoUid: row.destino_uid ? String(row.destino_uid) : null,
    destinoNome: row.destino_nome,
    dataCriacao: row.dt_criacao,
    dataAceite: row.dt_aceite,
    // Preenchido só quando é troca mútua (o solicitante também pediu uma
    // escala específica do destino em troca da sua).
    escalaSolicitadaId: row.escala_solicitada_cd ? String(row.escala_solicitada_cd) : null,
    escalaSolicitadaTipo: row.escala_solicitada_tipo || null,
    escalaSolicitadaDataInicio: row.escala_solicitada_dt_inicio || null,
    escalaSolicitadaDataFim: row.escala_solicitada_dt_fim || null,
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, id: userId, equipe: sessionEquipe } = session.user

  let userEquipe = sessionEquipe
  if ((role === 'gestor' || role === 'lider') && !userEquipe) {
    const { rows } = await query(
      `SELECT e.tp_equipe FROM usuarios u
       JOIN equipes e ON e.cd_equipe = u.cd_equipe
       WHERE u.cd_usuario = $1`,
      [userId]
    )
    userEquipe = rows[0]?.tp_equipe || null
  }

  let sql = SELECT_TROCAS
  let params: unknown[] = []

  if (role === 'admin') {
    // sem filtro: vê tudo
  } else if (role === 'gestor' || role === 'lider') {
    // gestor/líder veem a equipe inteira — líder também usa essa mesma
    // lista pra achar as próprias trocas (ele participa da escala, então
    // pode aparecer como solicitante/destino nela também).
    sql += ' WHERE eq.tp_equipe = $1'
    params = [userEquipe]
  } else {
    // qualquer colaborador (técnico, analista, desenvolvedor, ou perfil livre)
    sql += ' WHERE us.cd_usuario = $1 OR ud.cd_usuario = $1'
    params = [Number(userId)]
  }

  sql += ' ORDER BY te.dt_criacao DESC'

  try {
    const { rows } = await query(sql, params)
    return NextResponse.json(rows.map(toApiShape))
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, id: userId } = session.user
  if (role === 'admin' || role === 'gestor') {
    return NextResponse.json({ error: 'Apenas colaboradores podem solicitar troca' }, { status: 403 })
  }

  const body = await request.json()
  const { escalaId, tecnicoDestinoUid, dia, escalaSolicitadaId } = body

  if (!escalaId || !tecnicoDestinoUid) {
    return NextResponse.json({ error: 'Escala e técnico de destino são obrigatórios' }, { status: 400 })
  }

  try {
    // Escala + técnicos atualmente atribuídos
    const { rows: escalaRows } = await query(
      `SELECT es.cd_escala, es.cd_equipe, eq.tp_equipe,
              to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
              to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
              t.cd_tecnico, u.cd_usuario
       FROM escalas es
       JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
       LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE es.cd_escala = $1`,
      [escalaId]
    )
    if (escalaRows.length === 0) {
      return NextResponse.json({ error: 'Escala não encontrada' }, { status: 404 })
    }
    const escala = escalaRows[0]
    const solicitanteRow = escalaRows.find(r => String(r.cd_usuario) === String(userId))
    if (!solicitanteRow) {
      return NextResponse.json({ error: 'Você só pode solicitar troca de uma escala sua' }, { status: 403 })
    }

    if (dia && (dia < escala.dt_inicio || dia > escala.dt_fim)) {
      return NextResponse.json({ error: 'O dia informado está fora do período da escala' }, { status: 400 })
    }

    // Técnico de destino: precisa ser técnico/analista ativo da mesma equipe
    const { rows: destinoRows } = await query(
      `SELECT u.cd_usuario, u.tp_role, u.sn_ativo, e.tp_equipe, t.cd_tecnico
       FROM usuarios u
       LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
       LEFT JOIN tecnicos t ON t.cd_usuario = u.cd_usuario
       WHERE u.cd_usuario = $1`,
      [Number(tecnicoDestinoUid)]
    )
    const destino = destinoRows[0]
    if (!destino || !destino.cd_tecnico) {
      return NextResponse.json({ error: 'Técnico de destino não encontrado' }, { status: 404 })
    }
    if (String(destino.cd_usuario) === String(userId)) {
      return NextResponse.json({ error: 'Não é possível solicitar troca consigo mesmo' }, { status: 400 })
    }
    if (destino.tp_role === 'admin' || destino.tp_role === 'gestor') {
      return NextResponse.json({ error: 'O destino precisa ser um colaborador (não admin/gestor)' }, { status: 400 })
    }
    if (!destino.sn_ativo) {
      return NextResponse.json({ error: 'O técnico de destino está inativo' }, { status: 400 })
    }
    if (destino.tp_equipe !== escala.tp_equipe) {
      return NextResponse.json({ error: 'A troca só pode ser feita dentro da mesma equipe' }, { status: 400 })
    }

    // Troca mútua (opcional): o solicitante também está pedindo uma escala
    // específica do destino — precisa ser realmente do destino.
    let cdEscalaSolicitada = null
    if (escalaSolicitadaId) {
      const { rows: escalaSolicitadaRows } = await query(
        `SELECT es.cd_escala, t.cd_usuario
         FROM escalas es
         JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
         JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
         WHERE es.cd_escala = $1`,
        [escalaSolicitadaId]
      )
      const pertenceAoDestino = escalaSolicitadaRows.some(r => String(r.cd_usuario) === String(destino.cd_usuario))
      if (!pertenceAoDestino) {
        return NextResponse.json({ error: 'A escala pedida em troca precisa ser do técnico de destino' }, { status: 400 })
      }
      cdEscalaSolicitada = escalaSolicitadaId
    }

    // Evita solicitação duplicada para o mesmo período
    const { rows: pendentesRows } = await query(
      `SELECT cd_troca_escala FROM trocas_escala
       WHERE cd_escala = $1 AND tp_status = 'pendente' AND dt_dia IS NOT DISTINCT FROM $2::date`,
      [escalaId, dia || null]
    )
    if (pendentesRows.length > 0) {
      return NextResponse.json({ error: 'Já existe uma solicitação pendente para esse período' }, { status: 400 })
    }

    const { rows } = await query(
      `INSERT INTO trocas_escala (cd_escala, cd_tecnico_solicitante, cd_tecnico_destino, dt_dia, cd_escala_solicitada, tp_status)
       VALUES ($1, $2, $3, $4, $5, 'pendente')
       RETURNING cd_troca_escala`,
      [escalaId, solicitanteRow.cd_tecnico, destino.cd_tecnico, dia || null, cdEscalaSolicitada]
    )

    return NextResponse.json({ id: String(rows[0].cd_troca_escala) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}
