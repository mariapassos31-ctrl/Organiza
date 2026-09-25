import type { PoolClient } from 'pg'
import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../../lib/db'
import { auth } from '../../../../auth'

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function criarEscalaSegmento(client: PoolClient, escala: any, dtInicio: string, dtFim: string, cdTecnico: number | string) {
  const { rows } = await client.query(
    `INSERT INTO escalas (tp_escala, cd_equipe, dt_inicio, dt_fim, ds_descricao, tp_status, cd_usuario_criador)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING cd_escala`,
    [escala.tp_escala, escala.cd_equipe, dtInicio, dtFim, escala.ds_descricao, escala.escala_tp_status, escala.cd_usuario_criador]
  )
  const novaEscalaId = rows[0].cd_escala
  await client.query('INSERT INTO escala_tecnicos (cd_escala, cd_tecnico) VALUES ($1, $2)', [novaEscalaId, cdTecnico])
  return novaEscalaId
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  const { acao } = await request.json()
  if (!['aceitar', 'recusar', 'cancelar'].includes(acao)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  let troca
  try {
    const { rows } = await query(
      `SELECT te.cd_troca_escala, te.cd_escala, te.tp_status, te.cd_escala_solicitada,
              te.cd_tecnico_solicitante, te.cd_tecnico_destino,
              to_char(te.dt_dia, 'YYYY-MM-DD') AS dt_dia,
              es.cd_equipe, es.tp_escala, es.ds_descricao, es.tp_status AS escala_tp_status,
              es.cd_usuario_criador,
              to_char(es.dt_inicio, 'YYYY-MM-DD') AS escala_dt_inicio,
              to_char(es.dt_fim, 'YYYY-MM-DD') AS escala_dt_fim,
              ts.cd_usuario AS solicitante_usuario_id,
              td.cd_usuario AS destino_usuario_id
       FROM trocas_escala te
       JOIN escalas es ON es.cd_escala = te.cd_escala
       JOIN tecnicos ts ON ts.cd_tecnico = te.cd_tecnico_solicitante
       LEFT JOIN tecnicos td ON td.cd_tecnico = te.cd_tecnico_destino
       WHERE te.cd_troca_escala = $1`,
      [id]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
    }
    troca = rows[0]
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }

  if (troca.tp_status !== 'pendente') {
    return NextResponse.json({ error: 'Esta solicitação já foi respondida' }, { status: 400 })
  }

  const userId = session.user.id
  if (acao === 'cancelar') {
    if (String(troca.solicitante_usuario_id) !== String(userId)) {
      return NextResponse.json({ error: 'Apenas quem solicitou pode cancelar' }, { status: 403 })
    }
    await query(`UPDATE trocas_escala SET tp_status = 'cancelada' WHERE cd_troca_escala = $1`, [id])
    return NextResponse.json({ ok: true })
  }

  // aceitar / recusar: só quem recebeu o pedido decide
  if (String(troca.destino_usuario_id) !== String(userId)) {
    return NextResponse.json({ error: 'Apenas o técnico solicitado pode aceitar ou recusar' }, { status: 403 })
  }

  if (acao === 'recusar') {
    await query(`UPDATE trocas_escala SET tp_status = 'recusada' WHERE cd_troca_escala = $1`, [id])
    return NextResponse.json({ ok: true })
  }

  // aceitar
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE trocas_escala SET tp_status = 'aceita', cd_tecnico_aceite = $1, dt_aceite = now() WHERE cd_troca_escala = $2`,
      [troca.cd_tecnico_destino, id]
    )

    const dia = troca.dt_dia
    const inicio = troca.escala_dt_inicio
    const fim = troca.escala_dt_fim

    if (!dia || (dia === inicio && dia === fim)) {
      // troca da escala inteira (ou escala de um único dia)
      await client.query(
        'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
        [troca.cd_tecnico_destino, troca.cd_escala, troca.cd_tecnico_solicitante]
      )
    } else if (dia === inicio) {
      await criarEscalaSegmento(client, troca, dia, dia, troca.cd_tecnico_destino)
      await client.query('UPDATE escalas SET dt_inicio = $1 WHERE cd_escala = $2', [addDays(dia, 1), troca.cd_escala])
    } else if (dia === fim) {
      await criarEscalaSegmento(client, troca, dia, dia, troca.cd_tecnico_destino)
      await client.query('UPDATE escalas SET dt_fim = $1 WHERE cd_escala = $2', [addDays(dia, -1), troca.cd_escala])
    } else {
      await criarEscalaSegmento(client, troca, dia, dia, troca.cd_tecnico_destino)
      await criarEscalaSegmento(client, troca, addDays(dia, 1), fim, troca.cd_tecnico_solicitante)
      await client.query('UPDATE escalas SET dt_fim = $1 WHERE cd_escala = $2', [addDays(dia, -1), troca.cd_escala])
    }

    // Troca mútua: a escala que o solicitante pediu do destino vai inteira
    // pro solicitante (sempre em bloco completo, sem recorte por dia).
    if (troca.cd_escala_solicitada) {
      await client.query(
        'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
        [troca.cd_tecnico_solicitante, troca.cd_escala_solicitada, troca.cd_tecnico_destino]
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ ok: true })
  } catch (error) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  } finally {
    client.release()
  }
}
