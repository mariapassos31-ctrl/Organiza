// Lógica pura (sem banco) do modo "Home Office em grupo fixo por dia":
// todo dia útil, um número fixo K de pessoas vai pra home office, respeitando:
//   1) quem tem horário de entrada às 07:00 nunca entra no grupo de H.O.
//   2) o grupo do dia nunca tem 2 pessoas da mesma especialidade
//   3) o grupo do dia evita (melhor esforço) colocar as 2 pessoas da mesma
//      dupla de baia em H.O. juntas
// Quem não está no grupo do dia fica presencial. O rodízio é justo: a cada
// dia, prioriza quem tem menos dias de H.O. acumulados até agora.

import { addDays, estaDeFerias } from './escalasRodizio'

function normalizarHora(hora) {
  if (!hora) return null
  return String(hora).slice(0, 5)
}

// Tenta montar um grupo de `quantidade` pessoas, na ordem de prioridade dada,
// nunca repetindo especialidade e (se `evitarDupla`) nunca repetindo baiaId.
function tentarFormarGrupo(candidatosOrdenados, quantidade, evitarDupla) {
  function backtrack(inicio, escolhidos) {
    if (escolhidos.length === quantidade) return escolhidos
    for (let i = inicio; i < candidatosOrdenados.length; i++) {
      const candidato = candidatosOrdenados[i]
      const especialidadeRepetida = escolhidos.some(e =>
        e.especialidade && candidato.especialidade && e.especialidade === candidato.especialidade
      )
      if (especialidadeRepetida) continue
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

  return { uids: [], aviso: `Não foi possível formar um grupo de ${quantidade} pessoa(s) em home office sem repetir especialidade` }
}

// participantes: [{ cd_usuario, cd_tecnico, nm_tecnico, especialidade, horarioEntrada, baiaId }]
// contagensIniciais: { [cd_usuario]: dias de H.O. já feitos antes (pra continuar o rodízio justo) }
export function construirBlocosHomeOfficePar({
  participantes,
  dataInicio,
  dataFim,
  diasTrabalho,
  quantidadeHomeOffice,
  contagensIniciais = {},
}) {
  const diasTrabalhoSet = new Set(diasTrabalho.map(Number))
  const diasUteis = []
  let cursor = dataInicio
  while (cursor <= dataFim) {
    const [y, m, d] = cursor.split('-').map(Number)
    if (diasTrabalhoSet.has(new Date(y, m - 1, d).getDay())) diasUteis.push(cursor)
    cursor = addDays(cursor, 1)
  }
  if (diasUteis.length === 0) return { blocos: [], avisos: [] }

  const semHorarioDas7 = participantes.filter(p => normalizarHora(p.horarioEntrada) !== '07:00')

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

  for (const dia of diasUteis) {
    const presentesHoje = participantes.filter(p => !estaDeFerias(p, dia))
    const elegiveisHoje = semHorarioDas7.filter(p => !estaDeFerias(p, dia))

    const escolhido = escolherGrupoDoDia(elegiveisHoje, contagens, quantidadeHomeOffice)
    if (escolhido.aviso) avisos.push({ data: dia, mensagem: escolhido.aviso })

    const escolhidosSet = new Set(escolhido.uids)
    for (const p of presentesHoje) {
      const tipo = escolhidosSet.has(p.cd_usuario) ? 'homeoffice' : 'presencial'
      marcar(p.cd_usuario, dia, tipo)
      if (tipo === 'homeoffice') contagens.set(p.cd_usuario, (contagens.get(p.cd_usuario) || 0) + 1)
    }
    for (const p of participantes) {
      if (estaDeFerias(p, dia)) fechar(p.cd_usuario)
    }
  }
  for (const p of participantes) fechar(p.cd_usuario)

  return { blocos, avisos }
}
