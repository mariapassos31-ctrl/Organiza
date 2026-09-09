import 'server-only'
import { query, equipeIdFromSlug } from './db'

const TIPOS_VALIDOS = ['presencial', 'homeoffice', 'sabado', 'sobreaviso']

export function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// "Escala Sábado" é um plantão semanal de 1 dia, não um bloco contínuo:
// aqui listamos só as datas de sábado dentro do período.
function getSabados(dataInicio, dataFim) {
  const sabados = []
  let cursor = dataInicio
  while (cursor <= dataFim) {
    const [y, m, d] = cursor.split('-').map(Number)
    if (new Date(y, m - 1, d).getDay() === 6) sabados.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return sabados
}

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

async function carregarParticipantes(equipeId, tecnicoUids) {
  const { rows: tecnicosEquipe } = await query(
    `SELECT u.cd_usuario, t.cd_tecnico, t.nm_tecnico
     FROM tecnicos t
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE t.sn_ativo = true AND t.cd_equipe = $1
     ORDER BY t.nm_tecnico`,
    [equipeId]
  )
  const selecionados = new Set(tecnicoUids.map(String))
  return tecnicosEquipe.filter(t => selecionados.has(String(t.cd_usuario)))
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
  const posicaoUltimo = participantes.findIndex(p => String(p.cd_usuario) === ultimoUid)
  let indice = posicaoUltimo === -1 ? 0 : (posicaoUltimo + 1) % participantes.length

  const blocos = []
  const pushBloco = (dtInicio, dtFim) => {
    const p = participantes[indice % participantes.length]
    blocos.push({ dtInicio, dtFim, cdTecnico: p.cd_tecnico, tecnicoUid: String(p.cd_usuario), tecnicoNome: p.nm_tecnico, tipo })
  }

  if (ehSabado) {
    for (let i = 0; i < sabados.length; i += bloco) {
      const grupo = sabados.slice(i, i + bloco)
      const p = participantes[indice % participantes.length]
      for (const dia of grupo) {
        blocos.push({ dtInicio: dia, dtFim: dia, cdTecnico: p.cd_tecnico, tecnicoUid: String(p.cd_usuario), tecnicoNome: p.nm_tecnico, tipo })
      }
      indice++
    }
  } else if (participantes.length === 1) {
    // Só 1 técnico: não há para quem revezar, então o período inteiro é dele
    // numa única escala contínua.
    pushBloco(dataInicio, dataFim)
  } else {
    let cursor = dataInicio
    while (cursor <= dataFim) {
      const fimCandidato = addDays(cursor, bloco - 1)
      const fimReal = fimCandidato < dataFim ? fimCandidato : dataFim
      pushBloco(cursor, fimReal)
      indice++
      cursor = addDays(fimReal, 1)
    }
  }

  return { equipeId, equipe, blocos }
}

// Modo "híbrido" (Presencial + Home Office divididos): a cada dia de
// trabalho, a equipe é dividida em dois grupos numa proporção definida. Um
// rodízio circular garante que, ao final de um ciclo completo (nº de dias
// de trabalho = nº de técnicos), todo mundo passou pela mesma quantidade
// de dias de cada tipo.
export async function montarPlanoHibrido({ role, userEquipe, body }) {
  const { dataInicio, dataFim, tecnicoUids, diasTrabalho, percentualHomeOffice } = body
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
  const percentual = Number(percentualHomeOffice)
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
    return { error: 'A porcentagem de home office precisa estar entre 0 e 100', status: 400 }
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

  const diasTrabalhoSet = new Set(diasTrabalho.map(Number))
  const diasUteis = []
  let cursor = dataInicio
  while (cursor <= dataFim) {
    const [y, m, d] = cursor.split('-').map(Number)
    if (diasTrabalhoSet.has(new Date(y, m - 1, d).getDay())) diasUteis.push(cursor)
    cursor = addDays(cursor, 1)
  }
  if (diasUteis.length === 0) {
    return { error: 'Não há nenhum dia de trabalho dentro do período selecionado', status: 400 }
  }

  const k = Math.round((n * percentual) / 100)

  const blocos = []
  for (let t = 0; t < n; t++) {
    const p = participantes[t]
    let atual = null
    const fechar = () => {
      if (!atual) return
      blocos.push({
        dtInicio: atual.dtInicio,
        dtFim: atual.dtFim,
        cdTecnico: p.cd_tecnico,
        tecnicoUid: String(p.cd_usuario),
        tecnicoNome: p.nm_tecnico,
        tipo: atual.tipo,
      })
      atual = null
    }
    for (let i = 0; i < diasUteis.length; i++) {
      const dia = diasUteis[i]
      const emHomeOffice = (((t - i) % n) + n) % n < k
      const tipoDoDia = emHomeOffice ? 'homeoffice' : 'presencial'
      const contiguo = atual && addDays(atual.dtFim, 1) === dia
      if (atual && atual.tipo === tipoDoDia && contiguo) {
        atual.dtFim = dia
      } else {
        fechar()
        atual = { tipo: tipoDoDia, dtInicio: dia, dtFim: dia }
      }
    }
    fechar()
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

  return { equipeId, equipe, blocos }
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
