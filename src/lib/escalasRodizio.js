// Lógica pura de geração de escalas (sem acesso a banco de dados), separada
// de escalasAuto.js para poder ser testada isoladamente.

import { ehFeriado } from './feriados'

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
// aqui listamos só as datas de sábado dentro do período (a empresa não abre
// em feriado, então um sábado que cai em feriado não entra na lista).
export function getSabados(dataInicio, dataFim) {
  const sabados = []
  let cursor = dataInicio
  while (cursor <= dataFim) {
    const [y, m, d] = cursor.split('-').map(Number)
    if (new Date(y, m - 1, d).getDay() === 6 && !ehFeriado(cursor)) sabados.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return sabados
}

// Acha a posição de continuação do rodízio: o participante seguinte a quem
// ficou com o último bloco (por uid). Sem último uid ou sem match, recomeça
// do início.
export function indiceContinuacao(participantes, ultimoUid) {
  if (!ultimoUid) return 0
  const posicao = participantes.findIndex(p => String(p.cd_usuario) === String(ultimoUid))
  return posicao === -1 ? 0 : (posicao + 1) % participantes.length
}

// true se o participante está de férias nessa data exata (feriasInicio/
// feriasFim são strings 'YYYY-MM-DD', comparáveis léxico-cronologicamente).
export function estaDeFerias(participante, dia) {
  return Boolean(
    participante.feriasInicio && participante.feriasFim &&
    participante.feriasInicio <= dia && dia <= participante.feriasFim
  )
}

// Monta os blocos do modo "rodízio": sábado (1 dia por sábado, agrupando
// `bloco` sábados seguidos por técnico) ou caso geral (blocos contínuos de
// `bloco` dias corridos). Percorre dia a dia (ou sábado a sábado): se o
// dono do turno está de férias naquele dia específico, passa a vez pro
// próximo disponível na fila (reiniciando a contagem do turno dele) — se
// ninguém estiver disponível, aquele dia fica sem escala e vira um aviso.
export function construirBlocosRodizio({ participantes, tipo, dataInicio, dataFim, bloco, indiceInicial = 0, sabados }) {
  const dias = tipo === 'sabado' ? (sabados || getSabados(dataInicio, dataFim)) : listarDias(dataInicio, dataFim)

  const blocos = []
  const avisos = []
  let atual = null
  let indiceOwner = indiceInicial
  let diasNoTurno = 0

  const fechar = () => {
    if (!atual) return
    const p = participantes[atual.participanteIdx]
    blocos.push({ dtInicio: atual.dtInicio, dtFim: atual.dtFim, cdTecnico: p.cd_tecnico, tecnicoUid: String(p.cd_usuario), tecnicoNome: p.nm_tecnico, tipo })
    atual = null
  }

  for (const dia of dias) {
    let candidatoIdx = indiceOwner
    let tentativas = 0
    while (estaDeFerias(participantes[candidatoIdx % participantes.length], dia) && tentativas < participantes.length) {
      candidatoIdx++
      tentativas++
    }
    if (tentativas >= participantes.length) {
      fechar()
      avisos.push({ data: dia, mensagem: 'Nenhum técnico disponível nesse dia (todos de férias)' })
      continue
    }

    if (candidatoIdx !== indiceOwner) {
      indiceOwner = candidatoIdx
      diasNoTurno = 0
    }

    const idxAtual = indiceOwner % participantes.length
    const contiguo = atual && addDays(atual.dtFim, 1) === dia
    if (atual && atual.participanteIdx === idxAtual && contiguo) {
      atual.dtFim = dia
    } else {
      fechar()
      atual = { dtInicio: dia, dtFim: dia, participanteIdx: idxAtual }
    }

    diasNoTurno++
    if (diasNoTurno >= bloco) {
      indiceOwner++
      diasNoTurno = 0
    }
  }
  fechar()

  return { blocos, avisos }
}

function listarDias(dataInicio, dataFim) {
  const dias = []
  let cursor = dataInicio
  while (cursor <= dataFim) {
    dias.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dias
}

// Monta os blocos do modo "híbrido" (divisão presencial/home office
// proporcional e justa): cada técnico de índice t fica em home office no dia
// útil de índice i quando (t - i) mod n < k. Esse rodízio circular garante
// que, ao final de um ciclo completo de n dias úteis, todo participante
// passou pela mesma quantidade de dias de cada tipo. Quem está de férias
// num dia específico simplesmente não recebe escala nesse dia (nem
// presencial nem home office).
export function construirBlocosHibrido({ participantes, dataInicio, dataFim, diasTrabalho, percentualHomeOffice }) {
  const n = participantes.length
  const diasTrabalhoSet = new Set(diasTrabalho.map(Number))
  const diasUteis = []
  let cursor = dataInicio
  while (cursor <= dataFim) {
    const [y, m, d] = cursor.split('-').map(Number)
    if (diasTrabalhoSet.has(new Date(y, m - 1, d).getDay()) && !ehFeriado(cursor)) diasUteis.push(cursor)
    cursor = addDays(cursor, 1)
  }
  if (diasUteis.length === 0) return []

  const k = Math.round((n * percentualHomeOffice) / 100)

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
      if (estaDeFerias(p, dia)) {
        fechar()
        continue
      }
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
  return blocos
}
