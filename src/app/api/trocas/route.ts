import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../lib/db'
import { auth } from '../../../auth'
import { motivoInelegibilidadeParaTipo } from '../../../lib/escalasConstants'
import { quemColideEspecialidadeNoHomeOffice, listarNomes } from '../../../lib/elegibilidadeHomeOffice'
import { isolarDiasComoEscalaPropria, type EscalaParaSegmento } from '../../../lib/escalaSegmento'
import { addDays } from '../../../lib/escalasRodizio'
import { notificarTrocaSolicitada } from '../../../lib/emailNotificacoes'

// O pedido de troca guarda cada lado numa ÚNICA escala (cd_escala /
// cd_escala_solicitada são colunas simples, não uma lista) — então os dias
// escolhidos precisam ser um bloco contínuo. Dias não-contíguos (ex: só
// segunda e quarta, pulando terça) viram MAIS de um pedaço isolado
// (isolarDiasComoEscalaPropria), e só o último seria referenciado pelo
// pedido — o(s) anterior(es) ficariam presos com o dono original sem
// nenhum erro visível. Melhor recusar aqui do que perder dias em silêncio.
function diasSaoContiguos(dias: string[]): boolean {
  if (dias.length <= 1) return true
  const ordenados = [...dias].sort()
  for (let i = 1; i < ordenados.length; i++) {
    if (addDays(ordenados[i - 1], 1) !== ordenados[i]) return false
  }
  return true
}

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
function toApiShape(row: any, itensExtras: any[]) {
  return {
    id: String(row.cd_troca_escala),
    status: row.tp_status,
    // "dia" só existe em pedidos antigos (de antes das escalas passarem a
    // ser recortadas pro tamanho exato na criação do pedido) — pedidos
    // novos já têm o período certinho em escalaDataInicio/escalaDataFim,
    // então "dia" vem null e a tela usa o período da escala mesmo.
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
    // Troca direta de admin/gestor: criada e aceita no mesmo instante (a
    // mesma transação usa "now()" pros dois campos), então os timestamps
    // saem idênticos — o que nunca acontece numa troca de verdade entre
    // colegas (sempre passa um tempo até a resposta).
    direta: Boolean(row.dt_aceite) && new Date(row.dt_criacao).getTime() === new Date(row.dt_aceite).getTime(),
    // Preenchido só quando é troca mútua (o solicitante também pediu uma
    // escala específica do destino em troca da sua).
    escalaSolicitadaId: row.escala_solicitada_cd ? String(row.escala_solicitada_cd) : null,
    escalaSolicitadaTipo: row.escala_solicitada_tipo || null,
    escalaSolicitadaDataInicio: row.escala_solicitada_dt_inicio || null,
    escalaSolicitadaDataFim: row.escala_solicitada_dt_fim || null,
    // Dias/períodos extras da mesma solicitação (ex: inverter dia 6 E dia
    // 13 num revezamento, numa ação só) — cada item já vem com o tamanho
    // exato recortado, igual o item principal.
    itensExtras: itensExtras.map(item => ({
      escalaTipo: item.tp_escala,
      escalaDataInicio: item.dt_inicio,
      escalaDataFim: item.dt_fim,
      escalaSolicitadaTipo: item.escala_solicitada_tipo || null,
      escalaSolicitadaDataInicio: item.escala_solicitada_dt_inicio || null,
      escalaSolicitadaDataFim: item.escala_solicitada_dt_fim || null,
    })),
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
    if (rows.length === 0) return NextResponse.json([])

    const { rows: itensRows } = await query(
      `SELECT tei.cd_troca_escala, es.tp_escala, to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
              to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
              esol.tp_escala AS escala_solicitada_tipo,
              to_char(esol.dt_inicio, 'YYYY-MM-DD') AS escala_solicitada_dt_inicio,
              to_char(esol.dt_fim, 'YYYY-MM-DD') AS escala_solicitada_dt_fim
       FROM trocas_escala_itens tei
       JOIN escalas es ON es.cd_escala = tei.cd_escala
       LEFT JOIN escalas esol ON esol.cd_escala = tei.cd_escala_solicitada
       WHERE tei.cd_troca_escala = ANY($1::int[])`,
      [rows.map(r => r.cd_troca_escala)]
    )
    const itensPorTroca = new Map<number, typeof itensRows>()
    for (const item of itensRows) {
      const lista = itensPorTroca.get(item.cd_troca_escala) || []
      lista.push(item)
      itensPorTroca.set(item.cd_troca_escala, lista)
    }

    return NextResponse.json(rows.map(r => toApiShape(r, itensPorTroca.get(r.cd_troca_escala) || [])))
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}

class ErroTroca extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

interface DestinoValidado {
  cd_usuario: number
  cd_tecnico: number
  tp_role: string
  tp_equipe: string
  sn_ativo: boolean
  ds_email: string
  nm_usuario: string
  nr_baia: number | null
  ds_especialidade: string | null
  sn_elegivel_home_office: boolean | null
}

interface ItemInput {
  escalaId: string | number
  dias: string[]
  escalaSolicitadaId?: string | number | null
  diasSolicitada?: string[]
}

interface ItemValidado {
  escala: EscalaParaSegmento & { cd_escala: number | string; dt_inicio: string; dt_fim: string }
  dias: string[]
  escalaSolicitada: (EscalaParaSegmento & { cd_escala: number | string; dt_inicio: string; dt_fim: string }) | null
  diasSolicitada: string[]
}

// Valida um "item" de troca (uma escala minha + opcionalmente uma escala
// específica do destino pedida em troca) — usado tanto pro item principal
// quanto pra cada item extra (ex: inverter dia 6 E dia 13 na mesma
// solicitação). Lança ErroTroca com a mensagem certa pra devolver ao
// cliente; nunca decide o status HTTP sozinho fora disso.
async function validarItemTroca(
  item: ItemInput,
  contexto: { userId: string | number; role: string; solicitanteCdTecnico: number; destino: DestinoValidado }
): Promise<ItemValidado> {
  const { userId, role, solicitanteCdTecnico, destino } = contexto
  const dias = (item.dias || []).filter(Boolean)
  const diasSolicitada = (item.diasSolicitada || []).filter(Boolean)

  if (!item.escalaId) {
    throw new ErroTroca('Escala é obrigatória em todo item da troca')
  }
  if (!diasSaoContiguos(dias) || !diasSaoContiguos(diasSolicitada)) {
    throw new ErroTroca('Escolha um bloco contínuo de dias (sem pular nenhum no meio)')
  }

  const { rows: escalaRows } = await query(
    `SELECT es.cd_escala, es.cd_equipe, es.tp_escala, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
            to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
            to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
            t.cd_tecnico, u.cd_usuario
     FROM escalas es
     LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE es.cd_escala = $1 AND es.tp_status != 'cancelada'`,
    [item.escalaId]
  )
  if (escalaRows.length === 0) {
    throw new ErroTroca('Escala não encontrada', 404)
  }
  const escala = escalaRows[0]
  const solicitanteRow = escalaRows.find((r: { cd_usuario: number }) => String(r.cd_usuario) === String(userId))
  if (!solicitanteRow) {
    throw new ErroTroca('Você só pode solicitar troca de uma escala sua', 403)
  }
  if (dias.some(d => d < escala.dt_inicio || d > escala.dt_fim)) {
    throw new ErroTroca('Algum dos dias informados está fora do período da escala')
  }

  const inicioColisao = dias.length > 0 ? dias.reduce((a, b) => (a < b ? a : b)) : escala.dt_inicio
  const fimColisao = dias.length > 0 ? dias.reduce((a, b) => (a > b ? a : b)) : escala.dt_fim
  const motivoDestino = motivoInelegibilidadeParaTipo(escala.tp_escala, {
    role: destino.tp_role,
    ehSupervisor: destino.nr_baia === 0,
    especialidade: destino.ds_especialidade,
    elegivelHomeOffice: destino.sn_elegivel_home_office !== false,
  })
  if (motivoDestino) {
    throw new ErroTroca(motivoDestino)
  }
  if (escala.tp_escala === 'homeoffice') {
    const quemColide = await quemColideEspecialidadeNoHomeOffice(
      escala.cd_equipe, inicioColisao, fimColisao, destino.ds_especialidade, solicitanteCdTecnico
    )
    if (quemColide.length > 0) {
      throw new ErroTroca(`Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColide)} já está(ão) em home office nesse período`)
    }
  }

  let escalaSolicitada: ItemValidado['escalaSolicitada'] = null
  if (item.escalaSolicitadaId) {
    if (dias.length === 0) {
      throw new ErroTroca('Selecione pelo menos um dia que você está oferecendo')
    }
    const { rows: escalaSolicitadaRows } = await query(
      `SELECT es.cd_escala, es.tp_escala, es.cd_equipe, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
              to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
              to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
              t.cd_usuario
       FROM escalas es
       JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       WHERE es.cd_escala = $1 AND es.tp_status != 'cancelada'`,
      [item.escalaSolicitadaId]
    )
    const pertenceAoDestino = escalaSolicitadaRows.some((r: { cd_usuario: number }) => String(r.cd_usuario) === String(destino.cd_usuario))
    if (!pertenceAoDestino) {
      throw new ErroTroca('A escala pedida em troca precisa ser do técnico de destino')
    }
    const escalaSolicitadaEnc = escalaSolicitadaRows[0]
    escalaSolicitada = escalaSolicitadaEnc
    if (diasSolicitada.some(d => d < escalaSolicitadaEnc.dt_inicio || d > escalaSolicitadaEnc.dt_fim)) {
      throw new ErroTroca('Algum dos dias informados (do outro lado da troca) está fora do período da escala')
    }
    if (dias.length !== diasSolicitada.length) {
      throw new ErroTroca('A troca precisa ser equivalente: a mesma quantidade de dias dos dois lados')
    }

    const { rows: solicitanteEligRows } = await query(
      `SELECT t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
       FROM tecnicos t WHERE t.cd_tecnico = $1`,
      [solicitanteCdTecnico]
    )
    const solicitanteElig = solicitanteEligRows[0] || {}
    const motivoSolicitante = motivoInelegibilidadeParaTipo(escalaSolicitadaEnc.tp_escala, {
      role,
      ehSupervisor: solicitanteElig.nr_baia === 0,
      especialidade: solicitanteElig.ds_especialidade,
      elegivelHomeOffice: solicitanteElig.sn_elegivel_home_office !== false,
    })
    if (motivoSolicitante) {
      throw new ErroTroca(`Você não pode receber essa escala: ${motivoSolicitante}`)
    }
    const inicioColisaoSolicitada = diasSolicitada.length > 0 ? diasSolicitada.reduce((a, b) => (a < b ? a : b)) : escalaSolicitadaEnc.dt_inicio
    const fimColisaoSolicitada = diasSolicitada.length > 0 ? diasSolicitada.reduce((a, b) => (a > b ? a : b)) : escalaSolicitadaEnc.dt_fim
    if (escalaSolicitadaEnc.tp_escala === 'homeoffice') {
      const quemColideMutua = await quemColideEspecialidadeNoHomeOffice(
        escala.cd_equipe, inicioColisaoSolicitada, fimColisaoSolicitada,
        solicitanteElig.ds_especialidade, destino.cd_tecnico
      )
      if (quemColideMutua.length > 0) {
        throw new ErroTroca(`Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColideMutua)} já está(ão) em home office no período que você está pedindo`)
      }
    }
  }

  return { escala, dias, escalaSolicitada, diasSolicitada }
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
  const { escalaId, tecnicoDestinoUid, escalaSolicitadaId } = body
  const dias: string[] = Array.isArray(body.dias) ? body.dias.filter(Boolean) : []
  const diasSolicitada: string[] = Array.isArray(body.diasSolicitada) ? body.diasSolicitada.filter(Boolean) : []
  // Itens extras: mesma forma do item principal, pra inverter mais de um
  // dia/período (ex: dois lados de um revezamento) numa solicitação só.
  const itensExtrasInput: ItemInput[] = Array.isArray(body.itensExtras) ? body.itensExtras : []

  if (!escalaId || !tecnicoDestinoUid) {
    return NextResponse.json({ error: 'Escala e técnico de destino são obrigatórios' }, { status: 400 })
  }

  try {
    // Técnico de destino: precisa ser técnico/analista ativo da mesma equipe
    // (mesmo pra qualquer item extra — a troca inteira é sempre com a
    // mesma pessoa).
    const { rows: escalaPrincipalRows } = await query(
      `SELECT eq.tp_equipe FROM escalas es JOIN equipes eq ON eq.cd_equipe = es.cd_equipe WHERE es.cd_escala = $1`,
      [escalaId]
    )
    if (escalaPrincipalRows.length === 0) {
      return NextResponse.json({ error: 'Escala não encontrada' }, { status: 404 })
    }
    const { rows: destinoRows } = await query(
      `SELECT u.cd_usuario, u.tp_role, u.sn_ativo, u.ds_email, u.nm_usuario, e.tp_equipe, t.cd_tecnico,
              t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
       FROM usuarios u
       LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
       LEFT JOIN tecnicos t ON t.cd_usuario = u.cd_usuario
       WHERE u.cd_usuario = $1`,
      [Number(tecnicoDestinoUid)]
    )
    const destino: DestinoValidado | undefined = destinoRows[0]
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
    if (destino.tp_equipe !== escalaPrincipalRows[0].tp_equipe) {
      return NextResponse.json({ error: 'A troca só pode ser feita dentro da mesma equipe' }, { status: 400 })
    }

    const { rows: solicitanteTecRows } = await query(
      `SELECT t.cd_tecnico FROM tecnicos t WHERE t.cd_usuario = $1`,
      [Number(userId)]
    )
    const solicitanteCdTecnico = solicitanteTecRows[0]?.cd_tecnico
    if (!solicitanteCdTecnico) {
      return NextResponse.json({ error: 'Você não está cadastrado como técnico' }, { status: 403 })
    }

    const contexto = { userId, role, solicitanteCdTecnico, destino }
    const itensParaValidar: ItemInput[] = [
      { escalaId, dias, escalaSolicitadaId, diasSolicitada },
      ...itensExtrasInput,
    ]

    const itensValidados: ItemValidado[] = []
    for (const item of itensParaValidar) {
      itensValidados.push(await validarItemTroca(item, contexto))
    }

    // Evita solicitação duplicada — outra troca pendente da mesma pessoa
    // cujo período se sobrepõe a algum dos itens sendo pedidos agora.
    for (const itemValidado of itensValidados) {
      const { rows: pendentesRows } = await query(
        `SELECT te.cd_troca_escala FROM trocas_escala te
         JOIN escalas es ON es.cd_escala = te.cd_escala
         WHERE te.tp_status = 'pendente' AND te.cd_tecnico_solicitante = $1
           AND es.dt_inicio <= $3::date AND es.dt_fim >= $2::date`,
        [solicitanteCdTecnico, itemValidado.escala.dt_inicio, itemValidado.escala.dt_fim]
      )
      if (pendentesRows.length > 0) {
        return NextResponse.json({ error: 'Já existe uma solicitação pendente para esse período' }, { status: 400 })
      }
    }

    // Recorta as escalas pros dias exatos pedidos ANTES de criar o pedido —
    // assim, na hora de aceitar, é sempre uma troca de escala inteira (que
    // já é do tamanho certo), sem precisar guardar uma lista de dias à
    // parte (o banco só tem uma coluna pra um único dia).
    const client = await getPool().connect()
    let cdTrocaEscala: number
    try {
      await client.query('BEGIN')

      const idsIsolados: Array<{ cdEscalaFinal: number | string; cdEscalaSolicitadaFinal: number | string | null }> = []
      for (const itemValidado of itensValidados) {
        // A validação de contiguidade acima garante um único pedaço aqui.
        const [cdEscalaFinal] = await isolarDiasComoEscalaPropria(client, itemValidado.escala, itemValidado.dias, solicitanteCdTecnico)
        let cdEscalaSolicitadaFinal: number | string | null = null
        if (itemValidado.escalaSolicitada) {
          ;[cdEscalaSolicitadaFinal] = await isolarDiasComoEscalaPropria(client, itemValidado.escalaSolicitada, itemValidado.diasSolicitada, destino.cd_tecnico)
        }
        idsIsolados.push({ cdEscalaFinal, cdEscalaSolicitadaFinal })
      }

      const [principal, ...extras] = idsIsolados
      const { rows } = await client.query(
        `INSERT INTO trocas_escala (cd_escala, cd_tecnico_solicitante, cd_tecnico_destino, cd_escala_solicitada, tp_status)
         VALUES ($1, $2, $3, $4, 'pendente')
         RETURNING cd_troca_escala`,
        [principal.cdEscalaFinal, solicitanteCdTecnico, destino.cd_tecnico, principal.cdEscalaSolicitadaFinal]
      )
      cdTrocaEscala = rows[0].cd_troca_escala

      for (const extra of extras) {
        await client.query(
          `INSERT INTO trocas_escala_itens (cd_troca_escala, cd_escala, cd_escala_solicitada) VALUES ($1, $2, $3)`,
          [cdTrocaEscala, extra.cdEscalaFinal, extra.cdEscalaSolicitadaFinal]
        )
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    await notificarTrocaSolicitada({ email: destino.ds_email, nome: destino.nm_usuario }, session.user.name || 'Um colega', cdTrocaEscala)

    return NextResponse.json({ id: String(cdTrocaEscala) }, { status: 201 })
  } catch (error) {
    if (error instanceof ErroTroca) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}
