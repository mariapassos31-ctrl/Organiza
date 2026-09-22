import 'server-only'
import { query, equipeIdFromSlug, getPool } from './db'
import { addDays, getSabados, indiceContinuacao, construirBlocosRodizio, construirBlocosHibrido } from './escalasRodizio'
import { construirBlocosHomeOfficePar } from './escalasHomeOfficePar'
import { ehJovemAprendiz } from './escalasConstants'

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
    `SELECT u.cd_usuario, u.tp_role, t.cd_tecnico, t.nm_tecnico, t.ds_especialidade, t.hr_entrada, t.nr_baia,
            t.sn_elegivel_home_office,
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
      role: t.tp_role,
      cd_tecnico: t.cd_tecnico,
      nm_tecnico: t.nm_tecnico,
      especialidade: t.ds_especialidade || null,
      horarioEntrada: t.hr_entrada ? String(t.hr_entrada).slice(0, 5) : null,
      baiaId: t.nr_baia ?? null,
      elegivelHomeOffice: t.sn_elegivel_home_office !== false,
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

// Mesma soma de buscarContagensHomeOffice, mas só considera dias que já
// terminaram antes de `antesDe` — usado ao recalcular uma janela futura,
// pra não contar (nem descontar) os dias que estão sendo refeitos agora.
async function buscarContagensHomeOfficeAntes(equipeId, tecnicoUids, antesDe) {
  const { rows } = await query(
    `SELECT u.cd_usuario, COALESCE(SUM(es.dt_fim - es.dt_inicio + 1), 0) AS dias
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE es.cd_equipe = $1 AND es.tp_escala = 'homeoffice' AND es.dt_fim < $2 AND u.cd_usuario = ANY($3::int[])
     GROUP BY u.cd_usuario`,
    [equipeId, antesDe, tecnicoUids.map(Number)]
  )
  const contagens = {}
  for (const r of rows) contagens[String(r.cd_usuario)] = Number(r.dias)
  return contagens
}

// Quantas pessoas da equipe (não só dos participantes desta geração) já
// estão escaladas em home office em cada dia do período — vem de escalas
// já existentes, possivelmente criadas numa geração anterior separada.
// Evita que gerar em pedaços (ex: mês a mês) estoure o limite diário.
async function buscarOcupacaoHomeOfficeExistente(equipeId, dataInicio, dataFim) {
  const { rows } = await query(
    `SELECT to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio,
            to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim
     FROM escalas es
     WHERE es.cd_equipe = $1 AND es.tp_escala = 'homeoffice'
       AND es.dt_inicio <= $3 AND es.dt_fim >= $2`,
    [equipeId, dataInicio, dataFim]
  )
  const porDia = {}
  for (const r of rows) {
    let cursor = r.dt_inicio > dataInicio ? r.dt_inicio : dataInicio
    const fim = r.dt_fim < dataFim ? r.dt_fim : dataFim
    while (cursor <= fim) {
      porDia[cursor] = (porDia[cursor] || 0) + 1
      cursor = addDays(cursor, 1)
    }
  }
  return porDia
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

  const participantesSelecionados = await carregarParticipantes(equipeId, tecnicoUids)
  if (participantesSelecionados.length === 0) {
    return { error: 'Nenhum dos técnicos selecionados pertence a esta equipe', status: 400 }
  }

  const ehSabado = tipo === 'sabado'

  // Analista e Aprendiz/Estagiário nunca entram na escala de sábado.
  const participantes = ehSabado
    ? participantesSelecionados.filter(p => p.role !== 'analista' && !ehJovemAprendiz(p.especialidade))
    : participantesSelecionados
  if (ehSabado && participantes.length === 0) {
    return { error: 'Nenhum dos técnicos selecionados pode entrar na escala de sábado (Analista e Aprendiz/Estagiário não participam)', status: 400 }
  }

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
    const elegiveis = participantes.filter(p =>
      !ehJovemAprendiz(p.especialidade) && p.baiaId !== 0 && p.elegivelHomeOffice !== false
    )
    if (elegiveis.length < quantidade) {
      return {
        error: `Só há ${elegiveis.length} técnico(s) elegível(is) para home office (excluindo Aprendiz/Estagiário, Supervisor e quem está marcado como não elegível), mas a quantidade pedida é ${quantidade}`,
        status: 400,
      }
    }
    const duracaoBlocoDias = Number(body.duracaoBlocoDiasHomeOffice) || 1
    if (!Number.isInteger(duracaoBlocoDias) || duracaoBlocoDias < 1) {
      return { error: 'A duração do bloco de home office precisa ser um número inteiro maior que zero', status: 400 }
    }
    const contagensIniciais = await buscarContagensHomeOffice(equipeId, participantes.map(p => p.cd_usuario))
    const ocupacaoExistentePorDia = await buscarOcupacaoHomeOfficeExistente(equipeId, dataInicio, dataFim)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio,
      dataFim,
      diasTrabalho,
      quantidadeHomeOffice: quantidade,
      duracaoBlocoDias,
      contagensIniciais,
      ocupacaoExistentePorDia,
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

function hojeISO() {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

// Chamada quando alguém suspende (ou reativa) o home office de um técnico.
// Refaz o rodízio de home office da equipe inteira, de hoje até onde a
// escala já tinha sido gerada, pra restaurar a quantidade de pessoas por
// dia (K) — os dias que ficaram "faltando gente" por causa da suspensão
// puxam outros técnicos elegíveis pro lugar, e quem foi suspenso some do
// rodízio automaticamente (a regra já está em construirBlocosHomeOfficePar).
// Não mexe em nada antes de hoje, nem em outros tipos de escala (sábado,
// sobreaviso).
export async function recalcularHomeOfficeEquipe(equipeId) {
  const dataInicioJanela = hojeISO()

  const { rows: horizonteRows } = await query(
    `SELECT to_char(MAX(dt_fim), 'YYYY-MM-DD') AS horizonte
     FROM escalas
     WHERE cd_equipe = $1 AND tp_escala IN ('homeoffice', 'presencial') AND dt_fim >= $2`,
    [equipeId, dataInicioJanela]
  )
  const horizonte = horizonteRows[0]?.horizonte
  if (!horizonte) return { recalculado: false }

  // Descobre K (quantidade por dia) olhando quantas pessoas estão em home
  // office no primeiro dia da janela que já tem alguém — antes de mexer em
  // qualquer coisa, pra não se auto-enganar contando um dia já esvaziado.
  const { rows: diaRows } = await query(
    `SELECT to_char(MIN(dt_inicio), 'YYYY-MM-DD') AS dia
     FROM escalas
     WHERE cd_equipe = $1 AND tp_escala = 'homeoffice' AND dt_fim >= $2`,
    [equipeId, dataInicioJanela]
  )
  const diaReferencia = diaRows[0]?.dia
  if (!diaReferencia) return { recalculado: false }
  const diaClamp = diaReferencia < dataInicioJanela ? dataInicioJanela : diaReferencia

  const { rows: kRows } = await query(
    `SELECT COUNT(DISTINCT et.cd_tecnico) AS k
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     WHERE es.cd_equipe = $1 AND es.tp_escala = 'homeoffice' AND es.dt_inicio <= $2 AND es.dt_fim >= $2`,
    [equipeId, diaClamp]
  )
  const quantidadeHomeOffice = Number(kRows[0]?.k) || 0
  if (quantidadeHomeOffice === 0) return { recalculado: false }

  // Duração do bloco: tamanho mais comum entre os blocos de H.O. atuais.
  const { rows: blocoRows } = await query(
    `SELECT (dt_fim - dt_inicio + 1) AS dias, COUNT(*) AS qtd
     FROM escalas
     WHERE cd_equipe = $1 AND tp_escala = 'homeoffice' AND dt_fim >= $2
     GROUP BY dias
     ORDER BY qtd DESC, dias DESC
     LIMIT 1`,
    [equipeId, dataInicioJanela]
  )
  const duracaoBlocoDias = Number(blocoRows[0]?.dias) || 1

  const diasTrabalho = [1, 2, 3, 4, 5]

  // Gestor/admin não entram no rodízio (mesmo tendo um registro em
  // tecnicos, ex: baia fixa própria) — só técnicos/analistas são escalados.
  // Quem está na baia 0 (Supervisor) também nunca é escalado.
  const { rows: tecnicosEquipe } = await query(
    `SELECT u.cd_usuario FROM tecnicos t JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE t.sn_ativo = true AND t.cd_equipe = $1 AND u.tp_role NOT IN ('gestor', 'admin')
       AND (t.nr_baia IS NULL OR t.nr_baia != 0)`,
    [equipeId]
  )
  const tecnicoUids = tecnicosEquipe.map(t => t.cd_usuario)
  const participantes = await carregarParticipantes(equipeId, tecnicoUids)
  if (participantes.length === 0) return { recalculado: false }

  const contagensIniciais = await buscarContagensHomeOfficeAntes(equipeId, tecnicoUids, dataInicioJanela)

  const { blocos, avisos } = construirBlocosHomeOfficePar({
    participantes,
    dataInicio: dataInicioJanela,
    dataFim: horizonte,
    diasTrabalho,
    quantidadeHomeOffice,
    duracaoBlocoDias,
    contagensIniciais,
  })

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    // Blocos que começaram antes de hoje e continuam até depois: preserva o
    // pedaço passado, só apaga (via UPDATE do fim) o pedaço futuro.
    await client.query(
      `UPDATE escalas SET dt_fim = ($2::date - INTERVAL '1 day')::date
       WHERE cd_equipe = $1 AND tp_escala IN ('homeoffice', 'presencial')
         AND dt_inicio < $2 AND dt_fim >= $2`,
      [equipeId, dataInicioJanela]
    )
    // O resto (começa hoje ou depois) é inteiramente futuro: apaga e recria.
    await client.query(
      `DELETE FROM escalas
       WHERE cd_equipe = $1 AND tp_escala IN ('homeoffice', 'presencial') AND dt_inicio >= $2`,
      [equipeId, dataInicioJanela]
    )
    for (const b of blocos) {
      const { rows } = await client.query(
        `INSERT INTO escalas (tp_escala, cd_equipe, dt_inicio, dt_fim, ds_descricao, tp_status)
         VALUES ($1, $2, $3, $4, $5, 'ativa')
         RETURNING cd_escala`,
        [b.tipo, equipeId, b.dtInicio, b.dtFim, 'Recalculada automaticamente (suspensão de home office)']
      )
      await client.query('INSERT INTO escala_tecnicos (cd_escala, cd_tecnico) VALUES ($1, $2)', [rows[0].cd_escala, b.cdTecnico])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return { recalculado: true, avisos }
}
