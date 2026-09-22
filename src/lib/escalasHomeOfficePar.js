// Lógica pura (sem banco) do modo "Home Office em grupo fixo por bloco de
// dias": a cada `duracaoBlocoDias` dias úteis, um número fixo K de pessoas
// vai pra home office (e fica lá o bloco inteiro, sem trocar no meio),
// respeitando:
//   1) quem é especialidade "Aprendiz"/"Estagiário" ou está na baia 0
//      (Supervisor) nunca entra no grupo de H.O., nem quem está marcado
//      manualmente como não elegível (elegivelHomeOffice === false)
//   2) o grupo nunca tem 2 pessoas da mesma especialidade
//   3) o grupo nunca tem 2 pessoas que entram às 07:00 juntas (quem entra
//      às 7h pode ir pra H.O. normalmente, só não pode duas ao mesmo tempo)
//   4) o grupo evita (melhor esforço) colocar as 2 pessoas da mesma dupla
//      de baia em H.O. juntas
// Quem não está no grupo fica presencial — exceto especialidade "Externo",
// que só aparece na escala nos dias em que é sorteado pro home office; nos
// demais dias simplesmente não tem escala (não vem presencial, não ocupa
// baia). O rodízio é justo: a cada bloco, prioriza quem tem menos dias de
// H.O. acumulados até agora.

import { addDays, estaDeFerias } from './escalasRodizio'
import { ehFeriado } from './feriados'
import { ehJovemAprendiz } from './escalasConstants'

function normalizarHora(hora) {
  if (!hora) return null
  return String(hora).slice(0, 5)
}

function nuncaVaiParaHomeOffice(p) {
  return ehJovemAprendiz(p.especialidade) || p.baiaId === 0 || p.elegivelHomeOffice === false
}

// Tenta montar um grupo de `quantidade` pessoas, na ordem de prioridade dada,
// nunca repetindo especialidade, nunca repetindo horário de entrada às 07:00
// e (se `evitarDupla`) nunca repetindo baiaId.
function tentarFormarGrupo(candidatosOrdenados, quantidade, evitarDupla) {
  function backtrack(inicio, escolhidos) {
    if (escolhidos.length === quantidade) return escolhidos
    for (let i = inicio; i < candidatosOrdenados.length; i++) {
      const candidato = candidatosOrdenados[i]
      const especialidadeRepetida = escolhidos.some(e =>
        e.especialidade && candidato.especialidade && e.especialidade === candidato.especialidade
      )
      if (especialidadeRepetida) continue
      const horario7Repetido = normalizarHora(candidato.horarioEntrada) === '07:00' &&
        escolhidos.some(e => normalizarHora(e.horarioEntrada) === '07:00')
      if (horario7Repetido) continue
      if (evitarDupla) {
        const duplaRepetida = escolhidos.some(e =>
          e.baiaId != null && candidato.baiaId != null && e.baiaId === candidato.baiaId
        )
        if (duplaRepetida) continue
      }
      const resultado = backtrack(i + 1, [...escolhidos, candidato])
      if (resultado) return resultado
    }
    return null
  }
  return backtrack(0, [])
}

function escolherGrupoDoDia(elegiveis, contagens, quantidade) {
  if (elegiveis.length < quantidade) {
    return { uids: [], aviso: `Não há técnicos elegíveis suficientes para formar o grupo de home office (precisa de ${quantidade})` }
  }

  const ordenados = [...elegiveis].sort((a, b) => {
    const diff = (contagens.get(a.cd_usuario) || 0) - (contagens.get(b.cd_usuario) || 0)
    if (diff !== 0) return diff
    return a.cd_usuario < b.cd_usuario ? -1 : a.cd_usuario > b.cd_usuario ? 1 : 0
  })

  const comDupla = tentarFormarGrupo(ordenados, quantidade, true)
  if (comDupla) return { uids: comDupla.map(p => p.cd_usuario) }

  const semDupla = tentarFormarGrupo(ordenados, quantidade, false)
  if (semDupla) {
    return {
      uids: semDupla.map(p => p.cd_usuario),
      aviso: 'Não foi possível evitar colocar as duas pessoas da mesma dupla de baia em home office no mesmo dia',
    }
  }

  return { uids: [], aviso: `Não foi possível formar um grupo de ${quantidade} pessoa(s) em home office sem repetir especialidade nem repetir horário de entrada às 07:00` }
}

// participantes: [{ cd_usuario, cd_tecnico, nm_tecnico, especialidade, horarioEntrada, baiaId, elegivelHomeOffice }]
// duracaoBlocoDias: quantos dias úteis seguidos a mesma dupla fica em H.O.
//   antes de passar a vez (padrão 1 = escolhe de novo todo dia, como antes)
// contagensIniciais: { [cd_usuario]: dias de H.O. já feitos antes (pra continuar o rodízio justo) }
// ocupacaoExistentePorDia: { [dia]: quantidade de pessoas que já estão de H.O.
//   nesse dia vindas de uma geração anterior (equipe inteira, não só os
//   participantes atuais) — garante que "exatamente K por dia" vale mesmo
//   gerando em pedaços separados, não só dentro de uma mesma chamada.
export function construirBlocosHomeOfficePar({
  participantes,
  dataInicio,
  dataFim,
  diasTrabalho,
  quantidadeHomeOffice,
  duracaoBlocoDias = 1,
  contagensIniciais = {},
  ocupacaoExistentePorDia = {},
}) {
  const diasTrabalhoSet = new Set(diasTrabalho.map(Number))
  const diasUteis = []
  let cursor = dataInicio
  while (cursor <= dataFim) {
    const [y, m, d] = cursor.split('-').map(Number)
    if (diasTrabalhoSet.has(new Date(y, m - 1, d).getDay()) && !ehFeriado(cursor)) diasUteis.push(cursor)
    cursor = addDays(cursor, 1)
  }
  if (diasUteis.length === 0) return { blocos: [], avisos: [] }

  const elegiveisBase = participantes.filter(p => !nuncaVaiParaHomeOffice(p))

  const contagens = new Map(participantes.map(p => [p.cd_usuario, contagensIniciais[p.cd_usuario] || 0]))
  const avisos = []
  const abertos = new Map()
  const blocos = []

  const fechar = (uid) => {
    const atual = abertos.get(uid)
    if (!atual) return
    const p = participantes.find(x => x.cd_usuario === uid)
    blocos.push({
      dtInicio: atual.dtInicio,
      dtFim: atual.dtFim,
      cdTecnico: p.cd_tecnico,
      tecnicoUid: String(uid),
      tecnicoNome: p.nm_tecnico,
      tipo: atual.tipo,
    })
    abertos.delete(uid)
  }

  const marcar = (uid, dia, tipo) => {
    const atual = abertos.get(uid)
    const contiguo = atual && addDays(atual.dtFim, 1) === dia
    if (atual && atual.tipo === tipo && contiguo) {
      atual.dtFim = dia
    } else {
      fechar(uid)
      abertos.set(uid, { tipo, dtInicio: dia, dtFim: dia })
    }
  }

  const tamanhoBloco = Math.max(1, Math.floor(duracaoBlocoDias))

  for (let i = 0; i < diasUteis.length; i += tamanhoBloco) {
    const diasDoBloco = diasUteis.slice(i, i + tamanhoBloco)

    // Só entra no sorteio do bloco quem está disponível (sem férias) em
    // TODOS os dias do bloco — evita começar um bloco de H.O. e ter que
    // interromper no meio por causa de férias.
    const elegiveisDoBloco = elegiveisBase.filter(p => diasDoBloco.every(dia => !estaDeFerias(p, dia)))

    const vagasPorDia = diasDoBloco.map(dia => Math.max(0, quantidadeHomeOffice - (ocupacaoExistentePorDia[dia] || 0)))
    const vagasDoBloco = Math.min(...vagasPorDia)

    let escolhido
    if (vagasDoBloco === 0) {
      escolhido = { uids: [] }
      const jaOcupadasMax = Math.max(...diasDoBloco.map(dia => ocupacaoExistentePorDia[dia] || 0))
      if (jaOcupadasMax > 0) {
        avisos.push({
          data: diasDoBloco[0],
          mensagem: 'Esse período já tem pessoa(s) em home office de uma geração anterior; ninguém a mais foi adicionado',
        })
      }
    } else {
      escolhido = escolherGrupoDoDia(elegiveisDoBloco, contagens, vagasDoBloco)
      if (escolhido.aviso) avisos.push({ data: diasDoBloco[0], mensagem: escolhido.aviso })
    }

    const escolhidosSet = new Set(escolhido.uids)

    for (const dia of diasDoBloco) {
      const presentesHoje = participantes.filter(p => !estaDeFerias(p, dia))
      for (const p of presentesHoje) {
        const ehHomeOffice = escolhidosSet.has(p.cd_usuario)
        // "Externo" só existe na escala quando está de home office — nos
        // dias em que não é sorteado, não vira presencial (ele não vem pro
        // escritório, não ocupa baia nenhuma).
        if (!ehHomeOffice && p.especialidade === 'Externo') {
          fechar(p.cd_usuario)
          continue
        }
        marcar(p.cd_usuario, dia, ehHomeOffice ? 'homeoffice' : 'presencial')
      }
      for (const p of participantes) {
        if (estaDeFerias(p, dia)) fechar(p.cd_usuario)
      }
    }
    for (const uid of escolhido.uids) {
      contagens.set(uid, (contagens.get(uid) || 0) + diasDoBloco.length)
    }
  }
  for (const p of participantes) fechar(p.cd_usuario)

  return { blocos, avisos }
}
