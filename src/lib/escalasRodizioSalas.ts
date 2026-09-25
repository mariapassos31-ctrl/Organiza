// Lógica pura (sem banco) do rodízio "Entre Salas": decide, pra cada
// escala presencial de quem participa do grupo, em qual das salas do
// grupo a pessoa senta — sempre priorizando quem tem menos dias
// acumulados naquela sala até agora, pra rodízio ser justo de verdade
// (e não só uma distribuição única, que travaria todo mundo pra sempre
// na primeira sala sorteada).

export interface EscalaParaDistribuir {
  cdEscala: number
  uid: string
  dtInicio: string
  dtFim: string
}

export interface ResultadoRodizioSalas {
  atribuicoes: Record<number, number> // cdEscala -> cdSala
}

function diasEntre(dtInicio: string, dtFim: string): number {
  const a = new Date(`${dtInicio}T00:00:00Z`).getTime()
  const b = new Date(`${dtFim}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000) + 1
}

// Duas coisas importam pro rodízio ser justo:
//   1) cada PESSOA ao longo do tempo passa por todas as salas do grupo,
//      não fica sempre na mesma;
//   2) num mesmo período, as pessoas ficam bem distribuídas entre as
//      salas (não empilha todo mundo que nunca foi escalado ainda na
//      sala de menor id).
// Por isso o placar de cada sala combina os dias que ESSA pessoa já
// acumulou nela (peso maior — decide primeiro) com o total de dias já
// distribuído ali nesta mesma geração (desempate, evita empilhar).
const PESO_PESSOAL = 100000

export function distribuirEntreSalas({
  escalas,
  salaIds,
  acumuladoInicial,
}: {
  escalas: EscalaParaDistribuir[]
  salaIds: number[]
  acumuladoInicial: Record<string, Record<number, number>>
}): ResultadoRodizioSalas {
  const pessoal: Record<string, Record<number, number>> = {}
  for (const uid of Object.keys(acumuladoInicial)) {
    pessoal[uid] = { ...acumuladoInicial[uid] }
  }
  const contagensPessoaisDe = (uid: string) => {
    if (!pessoal[uid]) pessoal[uid] = {}
    for (const s of salaIds) {
      if (pessoal[uid][s] === undefined) pessoal[uid][s] = 0
    }
    return pessoal[uid]
  }
  const global: Record<number, number> = {}
  for (const s of salaIds) global[s] = 0

  // Ordem cronológica (quem vem primeiro no período decide primeiro) —
  // com desempate estável por uid, pra geração ser determinística.
  const ordenadas = [...escalas].sort((a, b) =>
    a.dtInicio === b.dtInicio ? a.uid.localeCompare(b.uid) : a.dtInicio.localeCompare(b.dtInicio)
  )

  const atribuicoes: Record<number, number> = {}
  for (const e of ordenadas) {
    const contagens = contagensPessoaisDe(e.uid)
    const escolhida = [...salaIds].sort((a, b) =>
      (contagens[a] * PESO_PESSOAL + global[a]) - (contagens[b] * PESO_PESSOAL + global[b]) || (a - b)
    )[0]
    atribuicoes[e.cdEscala] = escolhida
    const dias = diasEntre(e.dtInicio, e.dtFim)
    contagens[escolhida] += dias
    global[escolhida] += dias
  }

  return { atribuicoes }
}
