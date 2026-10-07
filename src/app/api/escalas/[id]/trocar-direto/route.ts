import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool } from '../../../../../lib/db'
import type { PoolClient } from 'pg'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'
import { motivoInelegibilidadeParaTipo } from '../../../../../lib/escalasConstants'
import { quemColideEspecialidadeNoHomeOffice, quemColideRoleNoHomeOffice, listarNomes } from '../../../../../lib/elegibilidadeHomeOffice'
import { isolarDiasComoEscalaPropria, removerConflitosFisicos, TIPOS_PRESENCA_FISICA, type EscalaParaSegmento } from '../../../../../lib/escalaSegmento'
import { notificarTrocaDiretaAplicada } from '../../../../../lib/emailNotificacoes'

// Troca direta feita por admin/gestor no modal de editar escala: escolhe o
// técnico novo e os dias — o sistema descobre sozinho o que CADA um dos
// dois já tinha marcado (de presença física) em CADA dia escolhido, e
// inverte. Não precisa escolher manualmente "a escala da outra pessoa" —
// isso já causou troca de dias sem relação nenhuma entre si (uma semana de
// setembro por uma de outubro, sem ninguém perceber, porque o dropdown
// mostrava qualquer data).
//
// Cada dia é resolvido de forma independente e simétrica: se só uma das
// duas pessoas tinha algo marcado naquele dia, a outra simplesmente
// assume aquilo e a primeira fica sem nada nesse dia (funciona como uma
// atribuição sem troca, só nesse ponto). Não existe distinção entre "dia
// principal" e "dia extra" — é só uma lista de dias, tanto faz se algum
// deles é o mesmo da escala que a pessoa abriu pra chegar aqui.
// Fica registrada em trocas_escala (junto com as trocas normais entre
// colegas) só quando os dois lados tiveram de fato algo pra trocar entre
// si — é um resumo informativo, não a fonte da verdade de quem ficou com
// o quê (isso já está correto nas escalas em si).
interface PessoaElegivel {
  cd_tecnico: number
  tp_role: string
  nr_baia: number | null
  ds_especialidade: string | null
  sn_elegivel_home_office: boolean | null
}

interface FragmentoFisico {
  escala: EscalaParaSegmento & { cd_escala: number | string; dt_inicio: string; dt_fim: string }
  dias: string[]
}

async function buscarFragmentosFisicos(cdEquipe: number, cdTecnico: number, dias: string[]): Promise<FragmentoFisico[]> {
  if (dias.length === 0) return []
  const inicio = dias.reduce((a, b) => (a < b ? a : b))
  const fim = dias.reduce((a, b) => (a > b ? a : b))
  const { rows } = await query(
    `SELECT es.cd_escala, es.tp_escala, es.cd_equipe, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
            to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio, to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     WHERE et.cd_tecnico = $1 AND es.cd_equipe = $5 AND es.tp_status != 'cancelada'
       AND es.tp_escala = ANY($2::text[])
       AND es.dt_inicio <= $4 AND es.dt_fim >= $3`,
    [cdTecnico, Array.from(TIPOS_PRESENCA_FISICA), inicio, fim, cdEquipe]
  )
  const fragmentos: FragmentoFisico[] = []
  for (const r of rows) {
    const diasQueColidem = dias.filter(d => d >= r.dt_inicio && d <= r.dt_fim)
    if (diasQueColidem.length > 0) fragmentos.push({ escala: r, dias: diasQueColidem })
  }
  return fragmentos
}

class ErroTrocaDireta extends Error {}

// Especialidade Externo nunca ocupa baia — não tem uma escala própria, é só
// um rótulo calculado (responsável fixo, com backup assumindo quando ele
// está de home office ou de férias — ver DiaDetalhadoModal). Por isso, se
// numa troca direta ela receberia um fragmento Presencial, o certo não é
// dar uma escala de Home Office pra ela: é simplesmente NÃO dar nada — ela
// fica sem escala nesse dia e volta a aparecer como "Externo" sozinha (ou o
// backup assume, do jeito que já funciona). Quem está trocando confirma
// isso marcando o dia explicitamente (diasComoHomeOffice) em vez do sistema
// travar a troca inteira. Só vale quando o fragmento inteiro está coberto
// pela marcação — um dia só parcialmente marcado ainda bloqueia, pra não
// descartar sozinho um pedaço que a pessoa não escolheu.
function deveFicarSemBaiaExterno(frag: FragmentoFisico, recebe: PessoaElegivel, diasComoHomeOffice: Set<string>): boolean {
  return frag.escala.tp_escala === 'presencial'
    && recebe.ds_especialidade === 'Externo'
    && frag.dias.every(d => diasComoHomeOffice.has(d))
}

// Confere se `recebe` pode assumir cada fragmento (elegibilidade pro tipo +
// colisão de especialidade em home office). `outroLadoCdTecnico` é quem
// está do outro lado dessa mesma troca — precisa ficar de fora da checagem
// de colisão junto com o próprio `recebe`, porque o fragmento sendo
// avaliado é exatamente o que essa pessoa tem HOJE e está prestes a entregar
// nessa mesma operação: não é uma colisão de verdade com outra pessoa, é a
// troca acontecendo. `ehSuporte` restringe a checagem de Analista G./Analista
// — essa regra só existe pro Suporte (ver escalasHomeOfficePar.ts e o
// gerador automático, que já só liga `respeitarParAnalistaGeral` nessa
// equipe); nas demais, mesmo tendo líder/analista, os dois podem ficar em
// home office juntos sem problema.
async function validarFragmentos(cdEquipe: number, fragmentos: FragmentoFisico[], recebe: PessoaElegivel, rotuloRecebe: string, diasComoHomeOffice: Set<string>, outroLadoCdTecnico: number, ehSuporte: boolean): Promise<void> {
  for (const frag of fragmentos) {
    if (deveFicarSemBaiaExterno(frag, recebe, diasComoHomeOffice)) {
      // Não vai receber nada de verdade — sem checagem de elegibilidade
      // nem de colisão em home office, porque não vai existir escala
      // nenhuma pra essa pessoa nesse dia.
      continue
    }
    const motivo = motivoInelegibilidadeParaTipo(frag.escala.tp_escala, {
      role: recebe.tp_role,
      ehSupervisor: recebe.nr_baia === 0,
      especialidade: recebe.ds_especialidade,
      elegivelHomeOffice: recebe.sn_elegivel_home_office !== false,
    })
    if (motivo) {
      throw new ErroTrocaDireta(`${rotuloRecebe} não pode assumir o que a outra pessoa tinha marcado: ${motivo}`)
    }
    if (frag.escala.tp_escala === 'homeoffice') {
      const inicioFrag = frag.dias.reduce((a, b) => (a < b ? a : b))
      const fimFrag = frag.dias.reduce((a, b) => (a > b ? a : b))
      const quemColide = await quemColideEspecialidadeNoHomeOffice(
        cdEquipe, inicioFrag, fimFrag, recebe.ds_especialidade, [recebe.cd_tecnico, outroLadoCdTecnico]
      )
      if (quemColide.length > 0) {
        throw new ErroTrocaDireta(`Pessoas com a mesma especialidade não podem ficar em home office juntas: ${listarNomes(quemColide)} já está(ão) em home office nesse período`)
      }
      if (ehSuporte) {
        const quemColideRole = await quemColideRoleNoHomeOffice(
          cdEquipe, inicioFrag, fimFrag, recebe.tp_role, [recebe.cd_tecnico, outroLadoCdTecnico]
        )
        if (quemColideRole.length > 0) {
          throw new ErroTrocaDireta(`Analista G. e Analista não podem ficar em home office juntos: ${listarNomes(quemColideRole)} já está(ão) em home office nesse período`)
        }
      }
    }
  }
}

function checarDuplicados(fragmentos: FragmentoFisico[]) {
  const vistos = new Set<string>()
  for (const frag of fragmentos) {
    for (const dia of frag.dias) {
      if (vistos.has(dia)) {
        throw new ErroTrocaDireta(`Encontrei mais de uma escala cobrindo o dia ${dia} — corrija isso antes de trocar`)
      }
      vistos.add(dia)
    }
  }
}

async function isolarFragmentos(client: PoolClient, fragmentos: FragmentoFisico[], donoAtual: number, recebe: PessoaElegivel, diasComoHomeOffice: Set<string>): Promise<Array<{ id: number | string; tipo: string; descartado: boolean }>> {
  const resultado: Array<{ id: number | string; tipo: string; descartado: boolean }> = []
  for (const frag of fragmentos) {
    const ids = await isolarDiasComoEscalaPropria(client, frag.escala, frag.dias, donoAtual)
    const descartar = deveFicarSemBaiaExterno(frag, recebe, diasComoHomeOffice)
    if (descartar) {
      // Ninguém recebe esse pedaço — cancela, do mesmo jeito que
      // removerConflitosFisicos cancela um compromisso físico substituído.
      for (const id of ids) {
        await client.query(`UPDATE escalas SET tp_status = 'cancelada', dt_atualizacao = now() WHERE cd_escala = $1`, [id])
      }
    }
    for (const id of ids) resultado.push({ id, tipo: frag.escala.tp_escala, descartado: descartar })
  }
  return resultado
}

function agruparPorTipo(fragmentos: FragmentoFisico[], recebe: PessoaElegivel, diasComoHomeOffice: Set<string>): Array<{ tipo: string; dias: string[] }> {
  const porTipo = new Map<string, string[]>()
  for (const f of fragmentos) {
    const tipo = deveFicarSemBaiaExterno(f, recebe, diasComoHomeOffice) ? 'externo' : f.escala.tp_escala
    const lista = porTipo.get(tipo) || []
    lista.push(...f.dias)
    porTipo.set(tipo, lista)
  }
  return [...porTipo.entries()].map(([tipo, dias]) => ({ tipo, dias: dias.sort() }))
}

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
  const dias: string[] = Array.isArray(body.dias) ? [...new Set<string>(body.dias.filter(Boolean))] : []
  // Dias em que a pessoa quem vai receber já confirmou que, se esbarrar na
  // regra "Externo nunca fica Presencial", quer que vire Home Office em vez
  // de travar a troca inteira.
  const diasComoHomeOffice = new Set<string>(Array.isArray(body.diasComoHomeOffice) ? body.diasComoHomeOffice.filter(Boolean) : [])
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
      `SELECT es.cd_equipe, eq.tp_equipe,
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

    const { rows: novoRows } = await query(
      `SELECT u.cd_usuario, u.tp_role, u.ds_email, u.nm_usuario, e.tp_equipe, t.cd_tecnico,
              t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
       FROM usuarios u
       LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
       LEFT JOIN tecnicos t ON t.cd_usuario = u.cd_usuario
       WHERE u.cd_usuario = $1`,
      [Number(novoTecnicoUid)]
    )
    const novo: PessoaElegivel & { cd_usuario: number; tp_equipe: string; ds_email: string; nm_usuario: string } | undefined = novoRows[0]
    if (!novo || !novo.cd_tecnico) {
      return NextResponse.json({ error: 'Técnico não encontrado' }, { status: 404 })
    }
    if (novo.tp_equipe !== escala.tp_equipe) {
      return NextResponse.json({ error: 'A troca só pode ser feita dentro da mesma equipe' }, { status: 400 })
    }
    if (String(novo.cd_usuario) === String(escala.tecnico_antigo_uid)) {
      return NextResponse.json({ error: 'Selecione um técnico diferente do atual' }, { status: 400 })
    }

    const { rows: antigoEligRows } = await query(
      `SELECT u.tp_role, u.ds_email, u.nm_usuario, t.nr_baia, t.ds_especialidade, t.sn_elegivel_home_office
       FROM tecnicos t JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE t.cd_tecnico = $1`,
      [escala.tecnico_antigo_cd]
    )
    const antigo: PessoaElegivel & { ds_email?: string; nm_usuario?: string } = { cd_tecnico: escala.tecnico_antigo_cd, ...(antigoEligRows[0] || {}) }

    // O que cada um já tem, em CADA dia pedido — os dois lados são
    // descobertos do mesmo jeito, simétrico, sem um "lado principal".
    const fragAntigo = await buscarFragmentosFisicos(escala.cd_equipe, antigo.cd_tecnico, dias)
    const fragNovo = await buscarFragmentosFisicos(escala.cd_equipe, novo.cd_tecnico, dias)
    if (fragAntigo.length === 0 && fragNovo.length === 0) {
      return NextResponse.json({ error: 'Nenhuma escala física encontrada pra essas duas pessoas nesses dias' }, { status: 400 })
    }

    const ehSuporte = escala.tp_equipe === 'suporte'
    await validarFragmentos(escala.cd_equipe, fragAntigo, novo, 'O técnico novo', diasComoHomeOffice, antigo.cd_tecnico, ehSuporte)
    await validarFragmentos(escala.cd_equipe, fragNovo, antigo, 'A pessoa atual', diasComoHomeOffice, novo.cd_tecnico, ehSuporte)

    // Dado saudável nunca deveria ter dois registros ativos da mesma
    // pessoa cobrindo o mesmo dia com tipo físico — mas se acontecer (dado
    // antigo corrompido, por exemplo), reatribuir os dois duplicaria a
    // pessoa num dia só. Melhor recusar aqui do que propagar a duplicação.
    checarDuplicados(fragAntigo)
    checarDuplicados(fragNovo)

    const client = await getPool().connect()
    try {
      await client.query('BEGIN')

      const idsAntigo = await isolarFragmentos(client, fragAntigo, antigo.cd_tecnico, novo, diasComoHomeOffice)
      const idsNovo = await isolarFragmentos(client, fragNovo, novo.cd_tecnico, antigo, diasComoHomeOffice)
      const idsEnvolvidos = [...idsAntigo, ...idsNovo].map(f => f.id)

      // Pedaços descartados (Externo que não pode ocupar baia) já foram
      // cancelados em isolarFragmentos — ninguém recebe, então ficam de
      // fora da reatribuição de dono.
      const idsAntigoParaNovo = idsAntigo.filter(f => !f.descartado)
      const idsNovoParaAntigo = idsNovo.filter(f => !f.descartado)

      // Antes de reatribuir, remove qualquer OUTRO compromisso físico que
      // cada lado já tivesse nos dias que está prestes a receber de fato
      // (dias descartados não contam — a pessoa não está recebendo nada
      // neles, só liberando a vaga do Externo).
      const diasQueNovoVaiReceber = fragAntigo.filter(f => !deveFicarSemBaiaExterno(f, novo, diasComoHomeOffice)).flatMap(f => f.dias)
      const diasQueAntigoVaiReceber = fragNovo.filter(f => !deveFicarSemBaiaExterno(f, antigo, diasComoHomeOffice)).flatMap(f => f.dias)
      if (diasQueNovoVaiReceber.length > 0) {
        await removerConflitosFisicos(client, escala.cd_equipe, novo.cd_tecnico, diasQueNovoVaiReceber, idsEnvolvidos)
      }
      if (diasQueAntigoVaiReceber.length > 0) {
        await removerConflitosFisicos(client, escala.cd_equipe, antigo.cd_tecnico, diasQueAntigoVaiReceber, idsEnvolvidos)
      }

      for (const frag of idsAntigoParaNovo) {
        await client.query('UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3', [novo.cd_tecnico, frag.id, antigo.cd_tecnico])
      }
      for (const frag of idsNovoParaAntigo) {
        await client.query('UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3', [antigo.cd_tecnico, frag.id, novo.cd_tecnico])
      }

      // Registro histórico — um resumo só (não é a fonte da verdade, só
      // aparece na lista de "Trocas"), e só quando os dois lados tiveram
      // de fato algo pra passar pra outra pessoa (um lado só descartado
      // não é uma troca de verdade, é só liberar a vaga do Externo).
      if (idsAntigoParaNovo.length > 0 && idsNovoParaAntigo.length > 0) {
        await client.query(
          `INSERT INTO trocas_escala (cd_escala, cd_tecnico_solicitante, cd_tecnico_destino, cd_tecnico_aceite, cd_escala_solicitada, tp_status, dt_aceite)
           VALUES ($1, $2, $3, $3, $4, 'aceita', now())`,
          [idsAntigoParaNovo[0].id, antigo.cd_tecnico, novo.cd_tecnico, idsNovoParaAntigo[0].id]
        )
      }

      await client.query('COMMIT')

      const novoAssumiu = agruparPorTipo(fragAntigo, novo, diasComoHomeOffice)
      const antigoAssumiu = agruparPorTipo(fragNovo, antigo, diasComoHomeOffice)
      const gestorNome = session.user.name || 'Um gestor'
      await Promise.all([
        notificarTrocaDiretaAplicada({ email: novo.ds_email, nome: novo.nm_usuario }, novoAssumiu, gestorNome),
        notificarTrocaDiretaAplicada({ email: antigo.ds_email ?? null, nome: antigo.nm_usuario ?? '' }, antigoAssumiu, gestorNome),
      ])

      return NextResponse.json({ ok: true, novoAssumiu, antigoAssumiu })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    if (error instanceof ErroTrocaDireta) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
