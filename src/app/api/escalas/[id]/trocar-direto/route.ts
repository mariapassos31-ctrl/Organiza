import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'
import { motivoInelegibilidadeParaTipo } from '../../../../../lib/escalasConstants'
import { quemColideEspecialidadeNoHomeOffice, listarNomes } from '../../../../../lib/elegibilidadeHomeOffice'
import { isolarDiasComoEscalaPropria, removerConflitosFisicos, TIPOS_PRESENCA_FISICA } from '../../../../../lib/escalaSegmento'
import { addDays } from '../../../../../lib/escalasRodizio'

// Troca direta feita por admin/gestor no modal de editar escala: escolhe
// explicitamente as DUAS pontas da troca — a escala/dias de quem está
// saindo (a que está sendo editada) e a escala/dias de quem está entrando
// (escalaParId, escolhida por quem está editando, não descoberta
// sozinha) — e troca as duas na hora, sem pedido de aceite (quem está
// fazendo já tem permissão de gestão, não é uma negociação entre
// colegas). Fica registrada em trocas_escala pra aparecer no histórico
// (junto com as trocas normais entre colegas) — como "dt_criacao" e
// "dt_aceite" saem com o mesmo "now()" da mesma transação, dá pra
// distinguir uma troca direta de uma troca de verdade (que sempre leva um
// tempo entre pedir e responder) sem precisar de uma coluna nova.
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
  const { novoTecnicoUid, escalaParId } = body
  const dias: string[] = Array.isArray(body.dias) ? body.dias.filter(Boolean) : []
  const diasPar: string[] = Array.isArray(body.diasPar) ? body.diasPar.filter(Boolean) : []
  if (!novoTecnicoUid) {
    return NextResponse.json({ error: 'Técnico é obrigatório' }, { status: 400 })
  }
  if (!escalaParId) {
    return NextResponse.json({ error: 'Escolha qual escala da outra pessoa entra na troca' }, { status: 400 })
  }
  if (dias.length === 0) {
    return NextResponse.json({ error: 'Selecione pelo menos um dia da escala atual pra trocar' }, { status: 400 })
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

    // A escala que a pessoa nova está oferecendo em troca — precisa ser
    // dela mesma e não pode ser a própria escala que está sendo editada.
    const { rows: parRows } = await query(
      `SELECT es.cd_escala, es.tp_escala, es.cd_equipe, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
              to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
              to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
              t.cd_usuario AS dono_uid
       FROM escalas es
       JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       WHERE es.cd_escala = $1 AND es.tp_status != 'cancelada'`,
      [escalaParId]
    )
    const escalaPar = parRows[0]
    if (!escalaPar) {
      return NextResponse.json({ error: 'Escala oferecida em troca não encontrada' }, { status: 404 })
    }
    if (String(escalaPar.dono_uid) !== String(novo.cd_usuario)) {
      return NextResponse.json({ error: 'A escala oferecida em troca precisa ser da pessoa nova' }, { status: 400 })
    }
    if (String(escalaPar.cd_escala) === String(escala.cd_escala)) {
      return NextResponse.json({ error: 'Escolha uma escala diferente da que está sendo editada' }, { status: 400 })
    }
    // Troca entre tipos diferentes só é permitida quando os dois são tipos
    // de presença física (presencial/home office/sábado — todos ocupam o
    // mesmo tipo de "vaga", então trocar entre eles faz sentido). Sobreaviso
    // só troca com sobreaviso, já que não ocupa lugar físico nenhum.
    const tiposCompativeis = escalaPar.tp_escala === escala.tp_escala ||
      (TIPOS_PRESENCA_FISICA.has(escalaPar.tp_escala) && TIPOS_PRESENCA_FISICA.has(escala.tp_escala))
    if (!tiposCompativeis) {
      return NextResponse.json({ error: 'A troca só pode ser feita entre escalas do mesmo tipo, ou entre presencial/home office/sábado' }, { status: 400 })
    }
    if (diasPar.some((d: string) => d < escalaPar.dt_inicio || d > escalaPar.dt_fim)) {
      return NextResponse.json({ error: 'Algum dos dias informados (do outro lado da troca) está fora do período da escala' }, { status: 400 })
    }
    // Troca equivalente: a mesma quantidade de dias dos dois lados — nunca
    // um período inteiro (que pode ter qualquer tamanho) de um lado por uma
    // quantidade diferente do outro.
    if (dias.length !== diasPar.length) {
      return NextResponse.json({ error: 'A troca precisa ser equivalente: a mesma quantidade de dias dos dois lados' }, { status: 400 })
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

    const { rows: antigoEligRows } = await query(
      `SELECT u.tp_role, t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
       FROM tecnicos t JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE t.cd_tecnico = $1`,
      [escala.tecnico_antigo_cd]
    )
    const antigoElig = antigoEligRows[0] || {}
    const motivoAntigo = motivoInelegibilidadeParaTipo(escalaPar.tp_escala, {
      role: antigoElig.tp_role,
      ehSupervisor: antigoElig.nr_baia === 0,
      especialidade: antigoElig.ds_especialidade,
      elegivelHomeOffice: antigoElig.sn_elegivel_home_office !== false,
    })
    if (motivoAntigo) {
      return NextResponse.json({ error: `A pessoa atual não pode entrar na outra escala: ${motivoAntigo}` }, { status: 400 })
    }

    const inicioColisao = dias.length > 0 ? dias.reduce((a, b) => (a < b ? a : b)) : escala.dt_inicio
    const fimColisao = dias.length > 0 ? dias.reduce((a, b) => (a > b ? a : b)) : escala.dt_fim
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
    const inicioColisaoPar = diasPar.length > 0 ? diasPar.reduce((a: string, b: string) => (a < b ? a : b)) : escalaPar.dt_inicio
    const fimColisaoPar = diasPar.length > 0 ? diasPar.reduce((a: string, b: string) => (a > b ? a : b)) : escalaPar.dt_fim
    if (escalaPar.tp_escala === 'homeoffice') {
      const quemColideOutraPonta = await quemColideEspecialidadeNoHomeOffice(
        escala.cd_equipe, inicioColisaoPar, fimColisaoPar, antigoElig.ds_especialidade, novo.cd_tecnico
      )
      if (quemColideOutraPonta.length > 0) {
        return NextResponse.json(
          { error: `Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColideOutraPonta)} já está(ão) em home office no outro período` },
          { status: 400 }
        )
      }
    }

    const client = await getPool().connect()
    let cdEscalaFinal: number | string
    let cdEscalaParFinal: number | string
    try {
      await client.query('BEGIN')
      // Isola cada lado no tamanho exato pedido (sem trocar dono ainda) —
      // depois disso, trocar é sempre um caso só: escala inteira com
      // escala inteira, já do tamanho certo.
      cdEscalaFinal = await isolarDiasComoEscalaPropria(client, escala, dias, escala.tecnico_antigo_cd)
      cdEscalaParFinal = await isolarDiasComoEscalaPropria(client, escalaPar, diasPar, novo.cd_tecnico)

      // Antes de reatribuir, remove qualquer outro compromisso físico
      // (presencial/home office/sábado) que cada lado já tivesse nos dias
      // que está prestes a receber — feito ANTES das atribuições abaixo
      // pra não confundir com a escala que cada um está prestes a receber.
      // Quando nenhum dia específico foi escolhido de um lado, a troca foi
      // do período inteiro daquela escala — usa o período inteiro pra
      // checar colisão também.
      const diasParEfetivo = diasPar.length > 0 ? diasPar : (() => {
        const todos: string[] = []
        for (let d = escalaPar.dt_inicio; d <= escalaPar.dt_fim; d = addDays(d, 1)) todos.push(d)
        return todos
      })()
      if (TIPOS_PRESENCA_FISICA.has(escala.tp_escala)) {
        await removerConflitosFisicos(client, escala.cd_equipe, novo.cd_tecnico, dias, [cdEscalaFinal, cdEscalaParFinal])
      }
      if (TIPOS_PRESENCA_FISICA.has(escalaPar.tp_escala)) {
        await removerConflitosFisicos(client, escala.cd_equipe, escala.tecnico_antigo_cd, diasParEfetivo, [cdEscalaFinal, cdEscalaParFinal])
      }

      await client.query(
        'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
        [novo.cd_tecnico, cdEscalaFinal, escala.tecnico_antigo_cd]
      )
      await client.query(
        'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
        [escala.tecnico_antigo_cd, cdEscalaParFinal, novo.cd_tecnico]
      )

      // Registra no histórico de trocas (mesma tabela das trocas normais
      // entre colegas), já como "aceita" — não tem pedido pra aceitar,
      // quem fez já tinha permissão de gestão.
      await client.query(
        `INSERT INTO trocas_escala (cd_escala, cd_tecnico_solicitante, cd_tecnico_destino, cd_tecnico_aceite, cd_escala_solicitada, tp_status, dt_aceite)
         VALUES ($1, $2, $3, $3, $4, 'aceita', now())`,
        [cdEscalaFinal, escala.tecnico_antigo_cd, novo.cd_tecnico, cdEscalaParFinal]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({
      ok: true,
      trocouCom: diasPar.length > 0
        ? { tipo: escalaPar.tp_escala, dias: diasPar }
        : { tipo: escalaPar.tp_escala, dataInicio: escalaPar.dt_inicio, dataFim: escalaPar.dt_fim },
      periodoQueSaiu: dias.length > 0 ? { dias } : { dataInicio: escala.dt_inicio, dataFim: escala.dt_fim },
    })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
