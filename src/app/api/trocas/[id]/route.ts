import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { motivoInelegibilidadeParaTipo } from '../../../../lib/escalasConstants'
import { quemColideEspecialidadeNoHomeOffice, listarNomes } from '../../../../lib/elegibilidadeHomeOffice'
import { substituirTecnicoNoPeriodo } from '../../../../lib/escalaSegmento'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let troca: any
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
              td.cd_usuario AS destino_usuario_id,
              usol.tp_role AS solicitante_role,
              ts.nr_baia AS solicitante_nr_baia, ts.ds_especialidade AS solicitante_especialidade,
              ts.sn_elegivel_home_office AS solicitante_elegivel,
              udest.tp_role AS destino_role,
              td.nr_baia AS destino_nr_baia, td.ds_especialidade AS destino_especialidade,
              td.sn_elegivel_home_office AS destino_elegivel,
              esol.tp_escala AS solicitada_tp_escala,
              to_char(esol.dt_inicio, 'YYYY-MM-DD') AS solicitada_dt_inicio,
              to_char(esol.dt_fim, 'YYYY-MM-DD') AS solicitada_dt_fim
       FROM trocas_escala te
       JOIN escalas es ON es.cd_escala = te.cd_escala AND es.tp_status != 'cancelada'
       JOIN tecnicos ts ON ts.cd_tecnico = te.cd_tecnico_solicitante
       JOIN usuarios usol ON usol.cd_usuario = ts.cd_usuario
       LEFT JOIN tecnicos td ON td.cd_tecnico = te.cd_tecnico_destino
       LEFT JOIN usuarios udest ON udest.cd_usuario = td.cd_usuario
       LEFT JOIN escalas esol ON esol.cd_escala = te.cd_escala_solicitada
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

  // Itens extras da mesma solicitação (ex: inverter dia 6 E dia 13 num
  // revezamento numa ação só) — cada um é validado e aplicado igual ao
  // item principal, dentro da mesma transação (tudo ou nada).
  const { rows: itensExtras } = await query(
    `SELECT tei.cd_item, tei.cd_escala, tei.cd_escala_solicitada,
            es.tp_escala, es.cd_equipe, es.ds_descricao, es.tp_status AS escala_tp_status, es.cd_usuario_criador,
            to_char(es.dt_inicio, 'YYYY-MM-DD') AS escala_dt_inicio,
            to_char(es.dt_fim, 'YYYY-MM-DD') AS escala_dt_fim,
            esol.tp_escala AS solicitada_tp_escala,
            to_char(esol.dt_inicio, 'YYYY-MM-DD') AS solicitada_dt_inicio,
            to_char(esol.dt_fim, 'YYYY-MM-DD') AS solicitada_dt_fim
     FROM trocas_escala_itens tei
     JOIN escalas es ON es.cd_escala = tei.cd_escala
     LEFT JOIN escalas esol ON esol.cd_escala = tei.cd_escala_solicitada
     WHERE tei.cd_troca_escala = $1`,
    [id]
  )

  // Reconfere a elegibilidade na hora do aceite (não só na criação do
  // pedido) — o perfil de qualquer um dos dois pode ter mudado entre o
  // pedido e a resposta (virou Aprendiz, saiu de "elegível home office"
  // etc), e é aqui que a atribuição de fato acontece. Roda pro item
  // principal e pra cada item extra.
  interface ItemParaConferir {
    tp_escala: string
    escala_dt_inicio: string
    escala_dt_fim: string
    dt_dia?: string | null
    solicitada_tp_escala?: string | null
    solicitada_dt_inicio?: string | null
    solicitada_dt_fim?: string | null
    cd_escala_solicitada?: number | string | null
  }
  async function conferirElegibilidadeItem(item: ItemParaConferir): Promise<string | null> {
    const motivoDestino = motivoInelegibilidadeParaTipo(item.tp_escala, {
      role: troca.destino_role,
      ehSupervisor: troca.destino_nr_baia === 0,
      especialidade: troca.destino_especialidade,
      elegivelHomeOffice: troca.destino_elegivel !== false,
    })
    if (motivoDestino) return motivoDestino
    if (item.tp_escala === 'homeoffice') {
      const dia = item.dt_dia
      const quemColide = await quemColideEspecialidadeNoHomeOffice(
        troca.cd_equipe, dia || item.escala_dt_inicio, dia || item.escala_dt_fim,
        troca.destino_especialidade, troca.cd_tecnico_solicitante
      )
      if (quemColide.length > 0) {
        return `Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColide)} já está(ão) em home office nesse período`
      }
    }
    if (item.cd_escala_solicitada) {
      const motivoSolicitante = motivoInelegibilidadeParaTipo(item.solicitada_tp_escala as string, {
        role: troca.solicitante_role,
        ehSupervisor: troca.solicitante_nr_baia === 0,
        especialidade: troca.solicitante_especialidade,
        elegivelHomeOffice: troca.solicitante_elegivel !== false,
      })
      if (motivoSolicitante) return `O solicitante não pode receber essa escala: ${motivoSolicitante}`
      if (item.solicitada_tp_escala === 'homeoffice') {
        const quemColideMutua = await quemColideEspecialidadeNoHomeOffice(
          troca.cd_equipe, item.solicitada_dt_inicio as string, item.solicitada_dt_fim as string,
          troca.solicitante_especialidade, troca.cd_tecnico_destino
        )
        if (quemColideMutua.length > 0) {
          return `Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColideMutua)} já está(ão) em home office no período pedido`
        }
      }
    }
    return null
  }

  const motivoPrincipal = await conferirElegibilidadeItem(troca)
  if (motivoPrincipal) {
    return NextResponse.json({ error: motivoPrincipal }, { status: 400 })
  }
  for (const item of itensExtras) {
    const motivo = await conferirElegibilidadeItem(item)
    if (motivo) {
      return NextResponse.json({ error: motivo }, { status: 400 })
    }
  }

  // aceitar
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `UPDATE trocas_escala SET tp_status = 'aceita', cd_tecnico_aceite = $1, dt_aceite = now() WHERE cd_troca_escala = $2`,
      [troca.cd_tecnico_destino, id]
    )

    await substituirTecnicoNoPeriodo(
      client,
      {
        cd_escala: troca.cd_escala,
        tp_escala: troca.tp_escala,
        cd_equipe: troca.cd_equipe,
        ds_descricao: troca.ds_descricao,
        tp_status: troca.escala_tp_status,
        cd_usuario_criador: troca.cd_usuario_criador,
        dt_inicio: troca.escala_dt_inicio,
        dt_fim: troca.escala_dt_fim,
      },
      troca.dt_dia,
      troca.cd_tecnico_solicitante,
      troca.cd_tecnico_destino
    )

    // Troca mútua: a escala que o solicitante pediu já foi recortada pro
    // tamanho exato (dias específicos ou inteira) lá na criação do pedido
    // — aqui é sempre uma troca de escala inteira mesmo, do tamanho que já
    // é o certo.
    if (troca.cd_escala_solicitada) {
      await client.query(
        'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
        [troca.cd_tecnico_solicitante, troca.cd_escala_solicitada, troca.cd_tecnico_destino]
      )
    }

    // Mesma coisa, pra cada item extra (ex: o dia 13 do revezamento) —
    // dentro da mesma transação, então ou os dois lados de todos os itens
    // ficam certos, ou nada é aplicado.
    for (const item of itensExtras) {
      await substituirTecnicoNoPeriodo(
        client,
        {
          cd_escala: item.cd_escala,
          tp_escala: item.tp_escala,
          cd_equipe: item.cd_equipe,
          ds_descricao: item.ds_descricao,
          tp_status: item.escala_tp_status,
          cd_usuario_criador: item.cd_usuario_criador,
          dt_inicio: item.escala_dt_inicio,
          dt_fim: item.escala_dt_fim,
        },
        null,
        troca.cd_tecnico_solicitante,
        troca.cd_tecnico_destino
      )
      if (item.cd_escala_solicitada) {
        await client.query(
          'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
          [troca.cd_tecnico_solicitante, item.cd_escala_solicitada, troca.cd_tecnico_destino]
        )
      }
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
