import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../lib/db'
import { auth } from '../../../auth'
import { motivoInelegibilidadeParaTipo } from '../../../lib/escalasConstants'
import { quemColideEspecialidadeNoHomeOffice, listarNomes } from '../../../lib/elegibilidadeHomeOffice'
import { isolarDiasComoEscalaPropria } from '../../../lib/escalaSegmento'
import { addDays } from '../../../lib/escalasRodizio'

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
function toApiShape(row: any) {
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
  const { escalaId, tecnicoDestinoUid, escalaSolicitadaId } = body
  const dias: string[] = Array.isArray(body.dias) ? body.dias.filter(Boolean) : []
  const diasSolicitada: string[] = Array.isArray(body.diasSolicitada) ? body.diasSolicitada.filter(Boolean) : []

  if (!escalaId || !tecnicoDestinoUid) {
    return NextResponse.json({ error: 'Escala e técnico de destino são obrigatórios' }, { status: 400 })
  }
  if (!diasSaoContiguos(dias) || !diasSaoContiguos(diasSolicitada)) {
    return NextResponse.json({ error: 'Escolha um bloco contínuo de dias (sem pular nenhum no meio)' }, { status: 400 })
  }

  try {
    // Escala + técnicos atualmente atribuídos
    const { rows: escalaRows } = await query(
      `SELECT es.cd_escala, es.cd_equipe, es.tp_escala, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
              eq.tp_equipe,
              to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
              to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim,
              t.cd_tecnico, u.cd_usuario
       FROM escalas es
       JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
       LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE es.cd_escala = $1 AND es.tp_status != 'cancelada'`,
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

    if (dias.some(d => d < escala.dt_inicio || d > escala.dt_fim)) {
      return NextResponse.json({ error: 'Algum dos dias informados está fora do período da escala' }, { status: 400 })
    }

    // Técnico de destino: precisa ser técnico/analista ativo da mesma equipe
    const { rows: destinoRows } = await query(
      `SELECT u.cd_usuario, u.tp_role, u.sn_ativo, e.tp_equipe, t.cd_tecnico,
              t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
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

    // A escala que o destino vai receber precisa fazer sentido pro perfil
    // dele — as mesmas regras que o gerador automático aplica (Supervisor
    // nunca entra em nada, Estag/Aprendiz/Trainee nunca em home office ou
    // sábado, "Externo" nunca presencial fora do sorteio de home office).
    const motivoDestino = motivoInelegibilidadeParaTipo(escala.tp_escala, {
      role: destino.tp_role,
      ehSupervisor: destino.nr_baia === 0,
      especialidade: destino.ds_especialidade,
      elegivelHomeOffice: destino.sn_elegivel_home_office !== false,
    })
    if (motivoDestino) {
      return NextResponse.json({ error: motivoDestino }, { status: 400 })
    }
    const inicioColisao = dias.length > 0 ? dias.reduce((a, b) => (a < b ? a : b)) : escala.dt_inicio
    const fimColisao = dias.length > 0 ? dias.reduce((a, b) => (a > b ? a : b)) : escala.dt_fim
    if (escala.tp_escala === 'homeoffice') {
      const quemColide = await quemColideEspecialidadeNoHomeOffice(
        escala.cd_equipe, inicioColisao, fimColisao, destino.ds_especialidade, solicitanteRow.cd_tecnico
      )
      if (quemColide.length > 0) {
        return NextResponse.json(
          { error: `Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColide)} já está(ão) em home office nesse período` },
          { status: 400 }
        )
      }
    }

    // Troca mútua (opcional): o solicitante também está pedindo uma escala
    // específica do destino — precisa ser realmente do destino, o
    // solicitante precisa poder receber o tipo dela (mesmas regras acima,
    // só que na direção contrária), e a troca precisa ser equivalente: a
    // mesma quantidade de dias dos dois lados (nunca "escala inteira", que
    // pode ter qualquer tamanho, de um lado só).
    let escalaSolicitada: { cd_escala: number | string; tp_escala: string; cd_equipe: number; ds_descricao: string | null; tp_status: string; cd_usuario_criador: number | string | null; dt_inicio: string; dt_fim: string } | null = null
    if (escalaSolicitadaId) {
      if (dias.length === 0) {
        return NextResponse.json({ error: 'Selecione pelo menos um dia que você está oferecendo' }, { status: 400 })
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
        [escalaSolicitadaId]
      )
      const pertenceAoDestino = escalaSolicitadaRows.some(r => String(r.cd_usuario) === String(destino.cd_usuario))
      if (!pertenceAoDestino) {
        return NextResponse.json({ error: 'A escala pedida em troca precisa ser do técnico de destino' }, { status: 400 })
      }
      const escalaSolicitadaEnc = escalaSolicitadaRows[0]
      escalaSolicitada = escalaSolicitadaEnc
      if (diasSolicitada.some(d => d < escalaSolicitadaEnc.dt_inicio || d > escalaSolicitadaEnc.dt_fim)) {
        return NextResponse.json({ error: 'Algum dos dias informados (do outro lado da troca) está fora do período da escala' }, { status: 400 })
      }
      if (dias.length !== diasSolicitada.length) {
        return NextResponse.json({ error: 'A troca precisa ser equivalente: a mesma quantidade de dias dos dois lados' }, { status: 400 })
      }

      const { rows: solicitanteEligRows } = await query(
        `SELECT t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
         FROM tecnicos t WHERE t.cd_tecnico = $1`,
        [solicitanteRow.cd_tecnico]
      )
      const solicitanteElig = solicitanteEligRows[0] || {}
      const motivoSolicitante = motivoInelegibilidadeParaTipo(escalaSolicitadaEnc.tp_escala, {
        role,
        ehSupervisor: solicitanteElig.nr_baia === 0,
        especialidade: solicitanteElig.ds_especialidade,
        elegivelHomeOffice: solicitanteElig.sn_elegivel_home_office !== false,
      })
      if (motivoSolicitante) {
        return NextResponse.json({ error: `Você não pode receber essa escala: ${motivoSolicitante}` }, { status: 400 })
      }
      const inicioColisaoSolicitada = diasSolicitada.length > 0 ? diasSolicitada.reduce((a, b) => (a < b ? a : b)) : escalaSolicitadaEnc.dt_inicio
      const fimColisaoSolicitada = diasSolicitada.length > 0 ? diasSolicitada.reduce((a, b) => (a > b ? a : b)) : escalaSolicitadaEnc.dt_fim
      if (escalaSolicitadaEnc.tp_escala === 'homeoffice') {
        const quemColideMutua = await quemColideEspecialidadeNoHomeOffice(
          escala.cd_equipe, inicioColisaoSolicitada, fimColisaoSolicitada,
          solicitanteElig.ds_especialidade, destino.cd_tecnico
        )
        if (quemColideMutua.length > 0) {
          return NextResponse.json(
            { error: `Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColideMutua)} já está(ão) em home office no período que você está pedindo` },
            { status: 400 }
          )
        }
      }
    }

    // Evita solicitação duplicada — outra troca pendente da mesma pessoa
    // cujo período se sobrepõe ao que está sendo pedido agora.
    const { rows: pendentesRows } = await query(
      `SELECT te.cd_troca_escala FROM trocas_escala te
       JOIN escalas es ON es.cd_escala = te.cd_escala
       WHERE te.tp_status = 'pendente' AND te.cd_tecnico_solicitante = $1
         AND es.dt_inicio <= $3::date AND es.dt_fim >= $2::date`,
      [solicitanteRow.cd_tecnico, inicioColisao, fimColisao]
    )
    if (pendentesRows.length > 0) {
      return NextResponse.json({ error: 'Já existe uma solicitação pendente para esse período' }, { status: 400 })
    }

    // Recorta as escalas pros dias exatos pedidos ANTES de criar o pedido —
    // assim, na hora de aceitar, é sempre uma troca de escala inteira (que
    // já é do tamanho certo), sem precisar guardar uma lista de dias à
    // parte (o banco só tem uma coluna pra um único dia).
    const client = await getPool().connect()
    let cdEscalaFinal: number | string
    let cdEscalaSolicitadaFinal: number | string | null = null
    try {
      await client.query('BEGIN')
      // A validação de contiguidade acima garante um único pedaço aqui.
      ;[cdEscalaFinal] = await isolarDiasComoEscalaPropria(client, escala, dias, solicitanteRow.cd_tecnico)
      if (escalaSolicitada) {
        ;[cdEscalaSolicitadaFinal] = await isolarDiasComoEscalaPropria(client, escalaSolicitada, diasSolicitada, destino.cd_tecnico)
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const { rows } = await query(
      `INSERT INTO trocas_escala (cd_escala, cd_tecnico_solicitante, cd_tecnico_destino, cd_escala_solicitada, tp_status)
       VALUES ($1, $2, $3, $4, 'pendente')
       RETURNING cd_troca_escala`,
      [cdEscalaFinal, solicitanteRow.cd_tecnico, destino.cd_tecnico, cdEscalaSolicitadaFinal]
    )

    return NextResponse.json({ id: String(rows[0].cd_troca_escala) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}
