import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'
import { distribuirEntreSalas, type EscalaParaDistribuir } from '../../../../../lib/escalasRodizioSalas'

async function souDoGrupoOuAdmin(cdGrupo: number, minhaRole: string, minhaEquipe: string | null | undefined) {
  if (minhaRole === 'admin') return true
  const { rows } = await query(
    `SELECT 1 FROM salas s JOIN sala_equipes se ON se.cd_sala = s.cd_sala JOIN equipes e ON e.cd_equipe = se.cd_equipe
     WHERE s.cd_grupo_rodizio = $1 AND e.tp_equipe = $2 LIMIT 1`,
    [cdGrupo, minhaEquipe]
  )
  return rows.length > 0
}

// Decide, pra cada escala presencial (ou sábado) já existente nesse
// período, em qual sala do grupo a pessoa senta — só mexe em quem ainda
// não tem sala definida (cd_sala NULL), então rodar de novo não bagunça
// quem já foi decidido antes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (!ehPerfilGestao(minhaRole)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const { id } = await params
    const cdGrupo = Number(id)
    if (!(await souDoGrupoOuAdmin(cdGrupo, minhaRole, minhaEquipe))) {
      return NextResponse.json({ error: 'Você só pode gerar o rodízio de um grupo que a sua equipe já participa' }, { status: 403 })
    }
    const { dataInicio, dataFim } = await request.json()
    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'Período é obrigatório' }, { status: 400 })
    }
    if (dataFim < dataInicio) {
      return NextResponse.json({ error: 'A data final não pode ser antes da data inicial' }, { status: 400 })
    }

    const { rows: salasRows } = await query('SELECT cd_sala FROM salas WHERE cd_grupo_rodizio = $1', [cdGrupo])
    const salaIds: number[] = salasRows.map(s => s.cd_sala)
    if (salaIds.length < 2) {
      return NextResponse.json({ error: 'Esse rodízio precisa de pelo menos 2 salas ativas' }, { status: 400 })
    }

    const { rows: equipesRows } = await query(
      'SELECT DISTINCT cd_equipe FROM sala_equipes WHERE cd_sala = ANY($1::int[])',
      [salaIds]
    )
    const equipeIds: number[] = equipesRows.map(e => e.cd_equipe)
    if (equipeIds.length === 0) {
      return NextResponse.json({ error: 'Nenhuma equipe vinculada a esse rodízio' }, { status: 400 })
    }

    // Só pega escalas inteiramente dentro do período pedido, sem sala
    // ainda — evita partir um bloco que começou antes ou termina depois
    // do período em duas salas diferentes no meio do caminho.
    const { rows: escalasRows } = await query(
      `SELECT es.cd_escala, u.cd_usuario, to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio, to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim
       FROM escalas es
       JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE es.cd_equipe = ANY($1::int[]) AND es.tp_escala IN ('presencial', 'sabado')
         AND es.cd_sala IS NULL AND es.dt_inicio >= $2 AND es.dt_fim <= $3`,
      [equipeIds, dataInicio, dataFim]
    )

    if (escalasRows.length === 0) {
      return NextResponse.json({ atribuidas: 0, aviso: 'Nenhuma escala presencial sem sala nesse período' })
    }

    const { rows: historicoRows } = await query(
      `SELECT u.cd_usuario, es.cd_sala, SUM(es.dt_fim - es.dt_inicio + 1) AS dias
       FROM escalas es
       JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       JOIN usuarios u ON u.cd_usuario = t.cd_usuario
       WHERE es.cd_sala = ANY($1::int[]) AND es.dt_fim < $2
       GROUP BY u.cd_usuario, es.cd_sala`,
      [salaIds, dataInicio]
    )
    const acumuladoInicial: Record<string, Record<number, number>> = {}
    for (const r of historicoRows) {
      const uid = String(r.cd_usuario)
      if (!acumuladoInicial[uid]) acumuladoInicial[uid] = {}
      acumuladoInicial[uid][r.cd_sala] = Number(r.dias)
    }

    const escalasParaDistribuir: EscalaParaDistribuir[] = escalasRows.map(r => ({
      cdEscala: r.cd_escala,
      uid: String(r.cd_usuario),
      dtInicio: r.dt_inicio,
      dtFim: r.dt_fim,
    }))

    const { atribuicoes } = distribuirEntreSalas({ escalas: escalasParaDistribuir, salaIds, acumuladoInicial })

    for (const [cdEscala, cdSala] of Object.entries(atribuicoes)) {
      await query('UPDATE escalas SET cd_sala = $1 WHERE cd_escala = $2', [cdSala, Number(cdEscala)])
    }

    return NextResponse.json({ atribuidas: Object.keys(atribuicoes).length })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
