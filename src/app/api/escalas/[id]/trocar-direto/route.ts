import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'
import { motivoInelegibilidadeParaTipo } from '../../../../../lib/escalasConstants'
import { quemColideEspecialidadeNoHomeOffice, listarNomes } from '../../../../../lib/elegibilidadeHomeOffice'
import { isolarDiasComoEscalaPropria, removerConflitosFisicos, TIPOS_PRESENCA_FISICA, type EscalaParaSegmento } from '../../../../../lib/escalaSegmento'

// Troca direta feita por admin/gestor no modal de editar escala: escolhe só
// o técnico novo e os dias — o sistema descobre sozinho o que esse técnico
// já tinha marcado (de presença física) nesses mesmos dias, e devolve isso
// pra quem estava saindo. Não precisa escolher manualmente "a escala da
// outra pessoa" num dropdown — isso já causou troca de dias sem relação
// nenhuma entre si (uma semana de setembro por uma de outubro, sem
// ninguém perceber, porque o dropdown mostrava qualquer data).
//
// Cada dia é resolvido de forma independente: se o técnico novo não tinha
// nada marcado num desses dias, quem estava saindo simplesmente fica sem
// nada nesse dia (funciona como uma atribuição sem troca, só nesse ponto).
// Fica registrada em trocas_escala (junto com as trocas normais entre
// colegas) só quando teve de fato algo pra "voltar" — senão não é bem uma
// troca.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()
  const { novoTecnicoUid } = body
  const dias: string[] = Array.isArray(body.dias) ? body.dias.filter(Boolean) : []
  if (!novoTecnicoUid) {
    return NextResponse.json({ error: 'Técnico é obrigatório' }, { status: 400 })
  }
  if (dias.length === 0) {
    return NextResponse.json({ error: 'Selecione pelo menos um dia pra trocar' }, { status: 400 })
  }

  let userEquipe = sessionEquipe
  if (role !== 'admin' && !userEquipe) {
    const { rows } = await query(
      `SELECT e.tp_equipe FROM usuarios u JOIN equipes e ON e.cd_equipe = u.cd_equipe WHERE u.cd_usuario = $1`,
      [session.user.id]
    )
    userEquipe = rows[0]?.tp_equipe || null
  }

  try {
    const { rows: escalaRows } = await query(
      `SELECT es.cd_escala, es.cd_equipe, es.tp_escala, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
              eq.tp_equipe,
              to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
              to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
              t.cd_tecnico AS tecnico_antigo_cd, u.cd_usuario AS tecnico_antigo_uid
       FROM escalas es
       JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
       LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE es.cd_escala = $1 AND es.tp_status != 'cancelada'`,
      [id]
    )
    if (escalaRows.length === 0) {
      return NextResponse.json({ error: 'Escala não encontrada' }, { status: 404 })
    }
    const escala = escalaRows[0]
    if (!escala.tecnico_antigo_cd) {
      return NextResponse.json({ error: 'Essa escala não tem ninguém pra trocar de lugar' }, { status: 400 })
    }
    if (role !== 'admin' && escala.tp_equipe !== userEquipe) {
      return NextResponse.json({ error: 'Você só pode editar escalas da sua equipe' }, { status: 403 })
    }
    if (role === 'lider' && String(escala.tecnico_antigo_uid) === String(session.user.id)) {
      return NextResponse.json({ error: 'Você não pode editar a própria escala — solicite uma troca' }, { status: 403 })
    }
    if (dias.some(d => d < escala.dt_inicio || d > escala.dt_fim)) {
      return NextResponse.json({ error: 'Algum dos dias informados está fora do período da escala' }, { status: 400 })
    }

    const { rows: novoRows } = await query(
      `SELECT u.cd_usuario, u.tp_role, e.tp_equipe, t.cd_tecnico,
              t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
       FROM usuarios u
       LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
       LEFT JOIN tecnicos t ON t.cd_usuario = u.cd_usuario
       WHERE u.cd_usuario = $1`,
      [Number(novoTecnicoUid)]
    )
    const novo = novoRows[0]
    if (!novo || !novo.cd_tecnico) {
      return NextResponse.json({ error: 'Técnico não encontrado' }, { status: 404 })
    }
    if (novo.tp_equipe !== escala.tp_equipe) {
      return NextResponse.json({ error: 'A troca só pode ser feita dentro da mesma equipe' }, { status: 400 })
    }
    if (String(novo.cd_usuario) === String(escala.tecnico_antigo_uid)) {
      return NextResponse.json({ error: 'Selecione um técnico diferente do atual' }, { status: 400 })
    }

    const motivoNovo = motivoInelegibilidadeParaTipo(escala.tp_escala, {
      role: novo.tp_role,
      ehSupervisor: novo.nr_baia === 0,
      especialidade: novo.ds_especialidade,
      elegivelHomeOffice: novo.sn_elegivel_home_office !== false,
    })
    if (motivoNovo) {
      return NextResponse.json({ error: motivoNovo }, { status: 400 })
    }

    const inicioColisao = dias.reduce((a, b) => (a < b ? a : b))
    const fimColisao = dias.reduce((a, b) => (a > b ? a : b))
    if (escala.tp_escala === 'homeoffice') {
      const quemColide = await quemColideEspecialidadeNoHomeOffice(
        escala.cd_equipe, inicioColisao, fimColisao, novo.ds_especialidade, escala.tecnico_antigo_cd
      )
      if (quemColide.length > 0) {
        return NextResponse.json(
          { error: `Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColide)} já está(ão) em home office nesse período` },
          { status: 400 }
        )
      }
    }

    // O que o técnico novo já tinha (de presença física) nesses mesmos
    // dias — é isso que "volta" pra quem estava saindo. Pode ser mais de
    // uma escala (se o técnico novo tinha tipos diferentes em dias
    // diferentes dentro do período escolhido), ou nenhuma (se ele não
    // tinha nada marcado nesses dias).
    const { rows: escalasNovoRows } = await query(
      `SELECT es.cd_escala, es.tp_escala, es.cd_equipe, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
              to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio, to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim
       FROM escalas es
       JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       WHERE et.cd_tecnico = $1 AND es.tp_status != 'cancelada'
         AND es.tp_escala = ANY($2::text[])
         AND es.dt_inicio <= $4 AND es.dt_fim >= $3`,
      [novo.cd_tecnico, Array.from(TIPOS_PRESENCA_FISICA), inicioColisao, fimColisao]
    )

    const { rows: antigoEligRows } = await query(
      `SELECT u.tp_role, t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
       FROM tecnicos t JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE t.cd_tecnico = $1`,
      [escala.tecnico_antigo_cd]
    )
    const antigoElig = antigoEligRows[0] || {}

    const fragmentos: Array<{ escala: EscalaParaSegmento & { cd_escala: number; dt_inicio: string; dt_fim: string }; dias: string[] }> = []
    for (const r of escalasNovoRows) {
      const diasQueColidem = dias.filter(d => d >= r.dt_inicio && d <= r.dt_fim)
      if (diasQueColidem.length === 0) continue

      const motivoAntigo = motivoInelegibilidadeParaTipo(r.tp_escala, {
        role: antigoElig.tp_role,
        ehSupervisor: antigoElig.nr_baia === 0,
        especialidade: antigoElig.ds_especialidade,
        elegivelHomeOffice: antigoElig.sn_elegivel_home_office !== false,
      })
      if (motivoAntigo) {
        return NextResponse.json(
          { error: `A pessoa atual não pode assumir o que a pessoa nova tinha marcado: ${motivoAntigo}` },
          { status: 400 }
        )
      }
      if (r.tp_escala === 'homeoffice') {
        const inicioFrag = diasQueColidem.reduce((a, b) => (a < b ? a : b))
        const fimFrag = diasQueColidem.reduce((a, b) => (a > b ? a : b))
        const quemColideOutraPonta = await quemColideEspecialidadeNoHomeOffice(
          escala.cd_equipe, inicioFrag, fimFrag, antigoElig.ds_especialidade, novo.cd_tecnico
        )
        if (quemColideOutraPonta.length > 0) {
          return NextResponse.json(
            { error: `Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColideOutraPonta)} já está(ão) em home office no outro período` },
            { status: 400 }
          )
        }
      }
      fragmentos.push({ escala: r, dias: diasQueColidem })
    }

    // Dado saudável nunca deveria ter dois registros ativos do técnico
    // novo cobrindo o mesmo dia com tipo físico — mas se acontecer (dado
    // antigo corrompido, por exemplo), reatribuir os dois pra pessoa atual
    // a deixaria duplicada num dia só. Melhor recusar aqui do que propagar
    // a duplicação pro outro lado da troca.
    const diasJaVistos = new Set<string>()
    for (const frag of fragmentos) {
      for (const dia of frag.dias) {
        if (diasJaVistos.has(dia)) {
          return NextResponse.json(
            { error: `A pessoa nova tem mais de uma escala cobrindo o dia ${dia} — corrija isso antes de trocar` },
            { status: 400 }
          )
        }
        diasJaVistos.add(dia)
      }
    }

    const client = await getPool().connect()
    // isolarDiasComoEscalaPropria pode devolver MAIS de um id quando os
    // dias escolhidos não são contíguos (ex: primeiro e último dia de um
    // período, pulando o do meio) — cada pedaço vira uma escala própria, e
    // TODOS precisam ser reatribuídos, não só o primeiro/último.
    let cdEscalaFinalIds: Array<number | string> = []
    const idsIsoladosDoNovo: Array<{ id: number | string; tipo: string }> = []
    try {
      await client.query('BEGIN')
      // Isola o lado de quem está saindo no tamanho exato pedido (sem
      // trocar dono ainda), e isola também cada pedaço que o técnico novo
      // já tinha nesses dias.
      cdEscalaFinalIds = await isolarDiasComoEscalaPropria(client, escala, dias, escala.tecnico_antigo_cd)
      for (const frag of fragmentos) {
        const ids = await isolarDiasComoEscalaPropria(client, frag.escala, frag.dias, novo.cd_tecnico)
        for (const id of ids) idsIsoladosDoNovo.push({ id, tipo: frag.escala.tp_escala })
      }
      const idsEnvolvidos = [...cdEscalaFinalIds, ...idsIsoladosDoNovo.map(f => f.id)]

      // Antes de reatribuir, remove qualquer OUTRO compromisso físico que
      // cada lado já tivesse nos dias que está prestes a receber (além do
      // que está sendo trocado agora).
      if (TIPOS_PRESENCA_FISICA.has(escala.tp_escala)) {
        await removerConflitosFisicos(client, escala.cd_equipe, novo.cd_tecnico, dias, idsEnvolvidos)
      }
      const diasCobertosPorNovo = fragmentos.flatMap(f => f.dias)
      if (diasCobertosPorNovo.length > 0) {
        await removerConflitosFisicos(client, escala.cd_equipe, escala.tecnico_antigo_cd, diasCobertosPorNovo, idsEnvolvidos)
      }

      for (const id of cdEscalaFinalIds) {
        await client.query(
          'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
          [novo.cd_tecnico, id, escala.tecnico_antigo_cd]
        )
      }
      for (const frag of idsIsoladosDoNovo) {
        await client.query(
          'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
          [escala.tecnico_antigo_cd, frag.id, novo.cd_tecnico]
        )
      }

      // Registra no histórico de trocas (mesma tabela das trocas normais
      // entre colegas), já como "aceita" — não tem pedido pra aceitar,
      // quem fez já tinha permissão de gestão. Só quando teve de fato algo
      // pra voltar (senão é uma atribuição de um lado só, que já não vira
      // histórico de troca). Guarda só o primeiro id de cada lado — é um
      // registro histórico informativo, não a fonte da verdade de quem
      // ficou com o quê (isso já está correto nas escalas em si).
      if (idsIsoladosDoNovo.length > 0) {
        await client.query(
          `INSERT INTO trocas_escala (cd_escala, cd_tecnico_solicitante, cd_tecnico_destino, cd_tecnico_aceite, cd_escala_solicitada, tp_status, dt_aceite)
           VALUES ($1, $2, $3, $3, $4, 'aceita', now())`,
          [cdEscalaFinalIds[0], escala.tecnico_antigo_cd, novo.cd_tecnico, idsIsoladosDoNovo[0].id]
        )
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({
      ok: true,
      periodoQueSaiu: { dias },
      oQueNovoDeuEmTroca: fragmentos.map(f => ({ tipo: f.escala.tp_escala, dias: f.dias })),
    })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
