import 'server-only'
import { query, equipeIdFromSlug } from './db'
import { addDays, getSabados, indiceContinuacao, construirBlocosRodizio, construirBlocosHibrido } from './escalasRodizio'
import { construirBlocosHomeOfficePar } from './escalasHomeOfficePar'

const TIPOS_VALIDOS = ['presencial', 'homeoffice', 'sabado', 'sobreaviso']

export { addDays, getSabados }

export async function resolverEquipeGestor(sessionUser) {
  if (sessionUser.equipe) return sessionUser.equipe
  const { rows } = await query(
    `SELECT e.tp_equipe FROM usuarios u
     JOIN equipes e ON e.cd_equipe = u.cd_equipe
     WHERE u.cd_usuario = $1`,
    [sessionUser.id]
  )
  return rows[0]?.tp_equipe || null
}

// Cada participante carrega seu período de férias (feriasInicio/feriasFim,
// se houver) — quem está de férias num dia específico é pulado nesse dia
// pelos motores de rotação, sem precisar tirá-lo da lista inteira.
async function carregarParticipantes(equipeId, tecnicoUids) {
  const { rows: tecnicosEquipe } = await query(
    `SELECT u.cd_usuario, t.cd_tecnico, t.nm_tecnico, t.ds_especialidade, t.hr_entrada, t.nr_baia,
            to_char(t.dt_ferias_inicio, 'YYYY-MM-DD') AS dt_ferias_inicio,
            to_char(t.dt_ferias_fim, 'YYYY-MM-DD') AS dt_ferias_fim
     FROM tecnicos t
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE t.sn_ativo = true AND t.cd_equipe = $1
     ORDER BY t.nm_tecnico`,
    [equipeId]
  )
  const selecionados = new Set(tecnicoUids.map(String))
  return tecnicosEquipe
    .filter(t => selecionados.has(String(t.cd_usuario)))
    .map(t => ({
      cd_usuario: t.cd_usuario,
      cd_tecnico: t.cd_tecnico,
      nm_tecnico: t.nm_tecnico,
      especialidade: t.ds_especialidade || null,
      horarioEntrada: t.hr_entrada ? String(t.hr_entrada).slice(0, 5) : null,
      baiaId: t.nr_baia ?? null,
      feriasInicio: t.dt_ferias_inicio || null,
      feriasFim: t.dt_ferias_fim || null,
    }))
}

// Soma quantos dias cada técnico já ficou em home office nessa equipe até
// agora, pra uma geração nova continuar o rodízio justo em vez de resetar.
async function buscarContagensHomeOffice(equipeId, tecnicoUids) {
  const { rows } = await query(
    `SELECT u.cd_usuario, COALESCE(SUM(es.dt_fim - es.dt_inicio + 1), 0) AS dias
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE es.cd_equipe = $1 AND es.tp_escala = 'homeoffice' AND u.cd_usuario = ANY($2::int[])
     GROUP BY u.cd_usuario`,
    [equipeId, tecnicoUids.map(Number)]
  )
  const contagens = {}
  for (const r of rows) contagens[String(r.cd_usuario)] = Number(r.dias)
  return contagens
}

// Modo "rodízio" — usado para tipos de dono único por vez (Sábado,
// Sobreaviso, ou Presencial/Home Office isolados): um técnico ocupa um
// bloco de dias, depois passa a vez para o próximo, continuando de onde
// a última geração desse mesmo tipo+equipe parou.
export async function montarPlanoAuto({ role, userEquipe, body }) {
  const { tipo, dataInicio, dataFim, diasPorTecnico, tecnicoUids } = body
  const equipe = role === 'gestor' ? userEquipe : body.equipe

  if (!equipe || !tipo || !dataInicio || !dataFim) {
    return { error: 'Equipe, tipo e período são obrigatórios', status: 400 }
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return { error: 'Tipo de escala inválido', status: 400 }
  }
  if (tipo === 'sabado' && equipe !== 'suporte') {
    return { error: 'Escala do tipo Sábado só pode ser gerada para a equipe Suporte', status: 400 }
  }
  if (dataFim < dataInicio) {
    return { error: 'A data final não pode ser antes da data inicial', status: 400 }
  }
  const bloco = Number(diasPorTecnico)
  if (!Number.isInteger(bloco) || bloco < 1) {
    return { error: 'A duração de cada turno precisa ser um número inteiro maior que zero', status: 400 }
  }
  if (!Array.isArray(tecnicoUids) || tecnicoUids.length === 0) {
    return { error: 'Selecione ao menos um técnico', status: 400 }
  }

  const equipeId = await equipeIdFromSlug(equipe)
  if (!equipeId) {
    return { error: 'Equipe não encontrada', status: 404 }
  }

  const participantes = await carregarParticipantes(equipeId, tecnicoUids)
  if (participantes.length === 0) {
    return { error: 'Nenhum dos técnicos selecionados pertence a esta equipe', status: 400 }
  }

  const ehSabado = tipo === 'sabado'
  const sabados = ehSabado ? getSabados(dataInicio, dataFim) : []
  if (ehSabado && sabados.length === 0) {
    return { error: 'Não há nenhum sábado dentro do período selecionado', status: 400 }
  }

  // Tipos diferentes coexistem (ex: presencial + sobreaviso), então o
  // conflito só é checado dentro do MESMO tipo de escala.
  if (ehSabado) {
    const { rows: conflitos } = await query(
      `SELECT cd_escala FROM escalas
       WHERE cd_equipe = $1 AND tp_escala = $2 AND dt_inicio = ANY($3::date[])
       LIMIT 1`,
      [equipeId, tipo, sabados]
    )
    if (conflitos.length > 0) {
      return { error: 'Já existe escala de sábado cadastrada em algum desses dias', status: 400 }
    }
  } else {
    const { rows: conflitos } = await query(
      `SELECT cd_escala FROM escalas
       WHERE cd_equipe = $1 AND tp_escala = $2 AND dt_inicio <= $4 AND dt_fim >= $3
       LIMIT 1`,
      [equipeId, tipo, dataInicio, dataFim]
    )
    if (conflitos.length > 0) {
      return { error: 'Já existem escalas desse tipo cadastradas nesse período para esta equipe', status: 400 }
    }
  }

  // Continua o rodízio a partir de quem foi o último técnico escalado
  // (equipe + tipo) mais recentemente, senão começa do primeiro da lista.
  const { rows: ultimaRows } = await query(
    `SELECT u.cd_usuario
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE es.cd_equipe = $1 AND es.tp_escala = $2
     ORDER BY es.dt_fim DESC, es.cd_escala DESC
     LIMIT 1`,
    [equipeId, tipo]
  )
  const ultimoUid = ultimaRows[0]?.cd_usuario ? String(ultimaRows[0].cd_usuario) : null
  const indiceInicial = indiceContinuacao(participantes, ultimoUid)

  const { blocos, avisos } = construirBlocosRodizio({ participantes, tipo, dataInicio, dataFim, bloco, indiceInicial, sabados })

  return { equipeId, equipe, blocos, avisos }
}

// Modo "híbrido" (Presencial + Home Office divididos): a cada dia de
// trabalho, a equipe é dividida em dois grupos numa proporção definida. Um
// rodízio circular garante que, ao final de um ciclo completo (nº de dias
// de trabalho = nº de técnicos), todo mundo passou pela mesma quantidade
// de dias de cada tipo.
export async function montarPlanoHibrido({ role, userEquipe, body }) {
  const { dataInicio, dataFim, tecnicoUids, diasTrabalho, percentualHomeOffice, quantidadeHomeOffice } = body
  const equipe = role === 'gestor' ? userEquipe : body.equipe

  if (!equipe || !dataInicio || !dataFim) {
    return { error: 'Equipe e período são obrigatórios', status: 400 }
  }
  if (dataFim < dataInicio) {
    return { error: 'A data final não pode ser antes da data inicial', status: 400 }
  }
  if (!Array.isArray(tecnicoUids) || tecnicoUids.length === 0) {
    return { error: 'Selecione ao menos um técnico', status: 400 }
  }
  if (!Array.isArray(diasTrabalho) || diasTrabalho.length === 0) {
    return { error: 'Defina ao menos um dia de trabalho na semana', status: 400 }
  }

  // Modo "quantidade fixa": todo dia, exatamente K pessoas em home office
  // (respeitando especialidade/horário de entrada/dupla de baia). Modo
  // "percentual": divisão proporcional simples (comportamento original).
  const usandoQuantidadeFixa = quantidadeHomeOffice !== undefined && quantidadeHomeOffice !== null && quantidadeHomeOffice !== ''
  let percentual = null
  let quantidade = null
  if (usandoQuantidadeFixa) {
    quantidade = Number(quantidadeHomeOffice)
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return { error: 'A quantidade de pessoas em home office precisa ser um número inteiro maior que zero', status: 400 }
    }
  } else {
    percentual = Number(percentualHomeOffice)
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      return { error: 'A porcentagem de home office precisa estar entre 0 e 100', status: 400 }
    }
  }

  const equipeId = await equipeIdFromSlug(equipe)
  if (!equipeId) {
    return { error: 'Equipe não encontrada', status: 404 }
  }

  const participantes = await carregarParticipantes(equipeId, tecnicoUids)
  const n = participantes.length
  if (n === 0) {
    return { error: 'Nenhum dos técnicos selecionados pertence a esta equipe', status: 400 }
  }

  let blocos, avisos
  if (usandoQuantidadeFixa) {
    const elegiveis = participantes.filter(p => p.horarioEntrada !== '07:00')
    if (elegiveis.length < quantidade) {
      return {
        error: `Só há ${elegiveis.length} técnico(s) elegível(is) para home office (excluindo quem entra às 07:00), mas a quantidade pedida é ${quantidade}`,
        status: 400,
      }
    }
    const contagensIniciais = await buscarContagensHomeOffice(equipeId, participantes.map(p => p.cd_usuario))
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio,
      dataFim,
      diasTrabalho,
      quantidadeHomeOffice: quantidade,
      contagensIniciais,
    })
    blocos = resultado.blocos
    avisos = resultado.avisos
  } else {
    blocos = construirBlocosHibrido({ participantes, dataInicio, dataFim, diasTrabalho, percentualHomeOffice: percentual })
    avisos = []
  }

  if (blocos.length === 0) {
    return { error: 'Não há nenhum dia de trabalho dentro do período selecionado', status: 400 }
  }

  for (const p of participantes) {
    for (const tipo of ['presencial', 'homeoffice']) {
      const { rows: conflitos } = await query(
        `SELECT es.cd_escala FROM escalas es
         JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
         WHERE et.cd_tecnico = $1 AND es.tp_escala = $2 AND es.dt_inicio <= $4 AND es.dt_fim >= $3
         LIMIT 1`,
        [p.cd_tecnico, tipo, dataInicio, dataFim]
      )
      if (conflitos.length > 0) {
        return { error: `${p.nm_tecnico} já tem escala de ${tipo === 'presencial' ? 'presencial' : 'home office'} nesse período`, status: 400 }
      }
    }
  }

  return { equipeId, equipe, blocos, avisos }
}

// Recebe uma lista de blocos já decididos (ex: prévia editada manualmente
// pelo usuário) e valida cada um antes de criar, sem recalcular nada.
export async function montarPlanoManual({ role, userEquipe, body }) {
  const { blocosManuais } = body
  const equipe = role === 'gestor' ? userEquipe : body.equipe

  if (!equipe) {
    return { error: 'Equipe é obrigatória', status: 400 }
  }
  if (!Array.isArray(blocosManuais) || blocosManuais.length === 0) {
    return { error: 'Nenhuma escala para criar', status: 400 }
  }

  const equipeId = await equipeIdFromSlug(equipe)
  if (!equipeId) {
    return { error: 'Equipe não encontrada', status: 404 }
  }

  const { rows: tecnicosEquipe } = await query(
    `SELECT u.cd_usuario, t.cd_tecnico
     FROM tecnicos t
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE t.sn_ativo = true AND t.cd_equipe = $1`,
    [equipeId]
  )
  const cdTecnicoPorUid = new Map(tecnicosEquipe.map(t => [String(t.cd_usuario), t.cd_tecnico]))

  const blocos = []
  for (const b of blocosManuais) {
    if (!b.dataInicio || !b.dataFim || !b.tecnicoUid || !b.tipo) {
      return { error: 'Há uma escala inválida na lista ajustada', status: 400 }
    }
    if (!TIPOS_VALIDOS.includes(b.tipo)) {
      return { error: 'Tipo de escala inválido', status: 400 }
    }
    if (b.tipo === 'sabado' && equipe !== 'suporte') {
      return { error: 'Escala do tipo Sábado só pode ser usada pela equipe Suporte', status: 400 }
    }
    const cdTecnico = cdTecnicoPorUid.get(String(b.tecnicoUid))
    if (!cdTecnico) {
      return { error: 'Um dos técnicos escolhidos não pertence a esta equipe', status: 400 }
    }
    blocos.push({ dtInicio: b.dataInicio, dtFim: b.dataFim, cdTecnico, tipo: b.tipo })
  }

  for (const b of blocos) {
    const { rows: conflitos } = await query(
      `SELECT es.cd_escala FROM escalas es
       JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       WHERE et.cd_tecnico = $1 AND es.tp_escala = $2 AND es.dt_inicio <= $4 AND es.dt_fim >= $3
       LIMIT 1`,
      [b.cdTecnico, b.tipo, b.dtInicio, b.dtFim]
    )
    if (conflitos.length > 0) {
      return { error: 'Um dos técnicos já tem escala desse tipo nesse período', status: 400 }
    }
  }

  return { equipeId, equipe, blocos }
}

// Único ponto de despacho — usado tanto pela prévia quanto pela geração
// real, para as duas rotas nunca divergirem sobre qual função rodar.
export async function montarPlano({ role, userEquipe, body }) {
  if (Array.isArray(body.blocosManuais)) return montarPlanoManual({ role, userEquipe, body })
  if (body.tipo === 'hibrido') return montarPlanoHibrido({ role, userEquipe, body })
  return montarPlanoAuto({ role, userEquipe, body })
}
