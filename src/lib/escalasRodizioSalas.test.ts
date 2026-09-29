import { describe, it, expect } from 'vitest'
import { distribuirEntreSalas, type EscalaParaDistribuir } from './escalasRodizioSalas'

function escala(cdEscala: number, uid: string, dtInicio: string, dtFim: string): EscalaParaDistribuir {
  return { cdEscala, uid, dtInicio, dtFim }
}

describe('distribuirEntreSalas', () => {
  it('sem histórico, distribui em ordem cronológica priorizando a sala menos usada', () => {
    const resultado = distribuirEntreSalas({
      escalas: [
        escala(1, 'a', '2026-01-05', '2026-01-05'),
        escala(2, 'b', '2026-01-05', '2026-01-05'),
        escala(3, 'c', '2026-01-05', '2026-01-05'),
      ],
      salaIds: [10, 20],
      acumuladoInicial: {},
    })
    // a e b (ordem alfabética no desempate) entram nas duas salas, c volta pra sala 10 (a com menos dias agora)
    expect(resultado.atribuicoes[1]).toBe(10)
    expect(resultado.atribuicoes[2]).toBe(20)
    expect(resultado.atribuicoes[3]).toBe(10)
  })

  it('respeita o histórico acumulado — quem já ficou muito numa sala vai pra outra', () => {
    const resultado = distribuirEntreSalas({
      escalas: [escala(1, 'a', '2026-01-05', '2026-01-09')],
      salaIds: [10, 20],
      acumuladoInicial: { a: { 10: 30, 20: 0 } },
    })
    expect(resultado.atribuicoes[1]).toBe(20)
  })

  it('mesma pessoa em blocos sucessivos alterna de sala conforme os dias acumulam', () => {
    const resultado = distribuirEntreSalas({
      escalas: [
        escala(1, 'a', '2026-01-05', '2026-01-09'),
        escala(2, 'a', '2026-01-12', '2026-01-16'),
      ],
      salaIds: [10, 20],
      acumuladoInicial: {},
    })
    expect(resultado.atribuicoes[1]).toBe(10)
    expect(resultado.atribuicoes[2]).toBe(20)
  })

  it('desempate por menor cdSala quando os acumulados empatam', () => {
    const resultado = distribuirEntreSalas({
      escalas: [escala(1, 'a', '2026-01-05', '2026-01-05')],
      salaIds: [30, 10, 20],
      acumuladoInicial: {},
    })
    expect(resultado.atribuicoes[1]).toBe(10)
  })
})
