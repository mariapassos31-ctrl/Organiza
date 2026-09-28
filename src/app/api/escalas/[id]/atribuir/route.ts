import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'
import { motivoInelegibilidadeParaTipo } from '../../../../../lib/escalasConstants'
import { quemColideEspecialidadeNoHomeOffice, listarNomes } from '../../../../../lib/elegibilidadeHomeOffice'
import { isolarDiasComoEscalaPropria, removerConflitosFisicos, TIPOS_PRESENCA_FISICA } from '../../../../../lib/escalaSegmento'

// Atribuir alguém a dia(s) específicos de uma escala — diferente do
// "Trocar Direto": aqui é só de um lado, ninguém dá nada em troca. Isola o
// pedaço pedido (sem mexer no resto da escala, que continua com o técnico
// original) e passa só esse pedaço pro técnico novo. Não fica registrado
// em trocas_escala (não é uma troca) — mesmo critério de uma edição normal
// de escala, que também não vira histórico de troca.
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
    return NextResponse.json({ error: 'Selecione pelo menos um dia pra atribuir' }, { status: 400 })
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
      return NextResponse.json({ error: 'Essa escala não tem ninguém pra atribuir' }, { status: 400 })
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
      return NextResponse.json({ error: 'Só é possível atribuir dentro da mesma equipe' }, { status: 400 })
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

    const client = await getPool().connect()
    let cdEscalaFinal: number | string
    try {
      await client.query('BEGIN')
      // Isola só o pedaço pedido — o resto da escala continua com quem já
      // era, sem precisar de contrapartida nenhuma do técnico novo.
      cdEscalaFinal = await isolarDiasComoEscalaPropria(client, escala, dias, escala.tecnico_antigo_cd)
      // Antes de passar esses dias pro técnico novo, remove qualquer outro
      // compromisso físico (presencial/home office/sábado) que ele já
      // tivesse nesses mesmos dias — feito ANTES da atribuição abaixo pra
      // não confundir com a escala que ele está prestes a receber.
      if (TIPOS_PRESENCA_FISICA.has(escala.tp_escala)) {
        await removerConflitosFisicos(client, escala.cd_equipe, novo.cd_tecnico, dias, [cdEscalaFinal])
      }
      await client.query(
        'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
        [novo.cd_tecnico, cdEscalaFinal, escala.tecnico_antigo_cd]
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ ok: true, periodoAtribuido: { dias } })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
