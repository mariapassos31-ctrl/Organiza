import type { Participante } from './tipos'
import { describe, it, expect } from 'vitest'
import {
  addDays,
  getSabados,
  indiceContinuacao,
  construirBlocosRodizio,
  construirBlocosHibrido,
} from './escalasRodizio'
import { ehFeriado } from './feriados'

function diasNoBloco(dtInicio: string, dtFim: string) {
  const [y1, m1, d1] = dtInicio.split('-').map(Number)
  const [y2, m2, d2] = dtFim.split('-').map(Number)
  const inicio = new Date(y1, m1 - 1, d1)
  const fim = new Date(y2, m2 - 1, d2)
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1
}

function participantes(n: number): Participante[] {
  return Array.from({ length: n }, (_, i) => ({
    cd_usuario: `uid-${i}`,
    cd_tecnico: `t-${i}`,
    nm_tecnico: `Tecnico ${i}`,
  }))
}

describe('addDays', () => {
  it('soma dias dentro do mesmo mês', () => {
    expect(addDays('2026-01-10', 5)).toBe('2026-01-15')
  })

  it('vira o mês corretamente', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('vira o ano corretamente', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('subtrai dias com delta negativo', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('getSabados', () => {
  it('lista todos os sábados dentro de um período', () => {
    // Janeiro/2026: sábados em 03, 10, 17, 24, 31
    expect(getSabados('2026-01-01', '2026-01-31')).toEqual([
      '2026-01-03', '2026-01-10', '2026-01-17', '2026-01-24', '2026-01-31',
    ])
  })

  it('retorna vazio quando não há sábado no período', () => {
    // 2026-01-05 (segunda) até 2026-01-09 (sexta)
    expect(getSabados('2026-01-05', '2026-01-09')).toEqual([])
  })
})

describe('indiceContinuacao', () => {
  const p = participantes(3)

  it('começa do início quando não há último uid', () => {
    expect(indiceContinuacao(p, null)).toBe(0)
  })

  it('começa do início quando o último uid não é encontrado', () => {
    expect(indiceContinuacao(p, 'uid-inexistente')).toBe(0)
  })

  it('continua no próximo participante após o último', () => {
    expect(indiceContinuacao(p, 'uid-0')).toBe(1)
    expect(indiceContinuacao(p, 'uid-1')).toBe(2)
  })

  it('dá a volta (wrap-around) quando o último é o último da lista', () => {
    expect(indiceContinuacao(p, 'uid-2')).toBe(0)
  })
})

describe('construirBlocosRodizio', () => {
  it('participante único: período inteiro numa única escala contínua', () => {
    const { blocos } = construirBlocosRodizio({
      participantes: participantes(1),
      tipo: 'presencial',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      bloco: 5,
    })
    expect(blocos).toHaveLength(1)
    expect(blocos[0]).toMatchObject({ dtInicio: '2026-01-01', dtFim: '2026-01-31', tecnicoUid: 'uid-0' })
  })

  it('múltiplos participantes: revezam em blocos contínuos de N dias', () => {
    const { blocos } = construirBlocosRodizio({
      participantes: participantes(2),
      tipo: 'presencial',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-10',
      bloco: 3,
    })
    // blocos de 3 dias: 01-03, 04-06, 07-09, 10-10 (resto), revezando uid-0/uid-1
    expect(blocos.map(b => [b.dtInicio, b.dtFim, b.tecnicoUid])).toEqual([
      ['2026-01-01', '2026-01-03', 'uid-0'],
      ['2026-01-04', '2026-01-06', 'uid-1'],
      ['2026-01-07', '2026-01-09', 'uid-0'],
      ['2026-01-10', '2026-01-10', 'uid-1'],
    ])
  })

  it('respeita o índice inicial para continuar de onde parou', () => {
    const { blocos } = construirBlocosRodizio({
      participantes: participantes(2),
      tipo: 'presencial',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-03',
      bloco: 3,
      indiceInicial: 1,
    })
    expect(blocos[0].tecnicoUid).toBe('uid-1')
  })

  it('sábado: um dia por sábado, agrupando conforme o bloco', () => {
    const { blocos } = construirBlocosRodizio({
      participantes: participantes(3),
      tipo: 'sabado',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      bloco: 2,
    })
    const sabados = getSabados('2026-01-01', '2026-01-31')
    expect(blocos).toHaveLength(sabados.length)
    // Os 2 primeiros sábados vão para uid-0, os 2 seguintes para uid-1, o resto para uid-2
    expect(blocos.map(b => b.tecnicoUid)).toEqual(['uid-0', 'uid-0', 'uid-1', 'uid-1', 'uid-2'])
    expect(blocos.every(b => b.dtInicio === b.dtFim)).toBe(true)
  })

  it('sábado aceita a lista de sábados pré-calculada sem recalcular', () => {
    const sabados = ['2026-01-03', '2026-01-10']
    const { blocos } = construirBlocosRodizio({
      participantes: participantes(2),
      tipo: 'sabado',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
      bloco: 1,
      sabados,
    })
    expect(blocos.map(b => b.dtInicio)).toEqual(sabados)
  })

  it('passa a vez pro próximo disponível quando o dono do turno está de férias', () => {
    const participantesComFerias = participantes(2)
    participantesComFerias[0].feriasInicio = '2026-01-04'
    participantesComFerias[0].feriasFim = '2026-01-06'

    const { blocos, avisos } = construirBlocosRodizio({
      participantes: participantesComFerias,
      tipo: 'presencial',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-10',
      bloco: 10, // um turno só, se não fosse a férias ficaria tudo com uid-0
    })

    // uid-0 pega até o dia antes das férias, uid-1 assume durante a férias
    expect(blocos.map(b => [b.dtInicio, b.dtFim, b.tecnicoUid])).toEqual([
      ['2026-01-01', '2026-01-03', 'uid-0'],
      ['2026-01-04', '2026-01-10', 'uid-1'],
    ])
    expect(avisos).toEqual([])
  })

  it('um participante único de férias no meio do período gera dois blocos, pulando os dias de férias', () => {
    const participantesComFerias = participantes(1)
    participantesComFerias[0].feriasInicio = '2026-01-10'
    participantesComFerias[0].feriasFim = '2026-01-12'

    const { blocos, avisos } = construirBlocosRodizio({
      participantes: participantesComFerias,
      tipo: 'presencial',
      dataInicio: '2026-01-01',
      dataFim: '2026-01-15',
      bloco: 30,
    })

    expect(blocos.map(b => [b.dtInicio, b.dtFim])).toEqual([
      ['2026-01-01', '2026-01-09'],
      ['2026-01-13', '2026-01-15'],
    ])
    expect(avisos).toHaveLength(3)
    expect(avisos[0].data).toBe('2026-01-10')
  })

  it('quando todos estão de férias no mesmo dia, o dia fica sem escala e vira aviso', () => {
    const todosDeFerias = participantes(2).map(p => ({ ...p, feriasInicio: '2026-01-05', feriasFim: '2026-01-05' }))

    const { blocos, avisos } = construirBlocosRodizio({
      participantes: todosDeFerias,
      tipo: 'presencial',
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      bloco: 5,
    })

    expect(blocos).toEqual([])
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensagem).toMatch(/férias/)
  })
})

describe('construirBlocosHibrido', () => {
  it('retorna vazio quando nenhum dia do período cai nos dias de trabalho', () => {
    // diasTrabalho = [1] (segunda), período é só um fim de semana
    const blocos = construirBlocosHibrido({
      participantes: participantes(2),
      dataInicio: '2026-01-03', // sábado
      dataFim: '2026-01-04', // domingo
      diasTrabalho: [1],
      percentualHomeOffice: 50,
    })
    expect(blocos).toEqual([])
  })

  it('divide justamente ao longo de ciclos completos (fairness)', () => {
    const n = 4
    const k = 2 // 50%
    // 2 ciclos completos de n dias úteis (todos os dias da semana contam como úteis aqui)
    // começa em 01-02 (não 01-01) pra não esbarrar no feriado de Ano Novo
    const diasUteis = 2 * n
    const dataFim = addDays('2026-01-02', diasUteis - 1)
    const blocos = construirBlocosHibrido({
      participantes: participantes(n),
      dataInicio: '2026-01-02',
      dataFim,
      diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
      percentualHomeOffice: (k / n) * 100,
    })

    const totalPorParticipante: Record<string, Record<string, number>> = {}
    for (const b of blocos) {
      totalPorParticipante[b.tecnicoUid!] ??= { presencial: 0, homeoffice: 0 }
      totalPorParticipante[b.tecnicoUid!][b.tipo] += diasNoBloco(b.dtInicio, b.dtFim)
    }

    for (let t = 0; t < n; t++) {
      const totais = totalPorParticipante[`uid-${t}`]
      expect(totais.homeoffice).toBe(k * 2) // k dias de HO por ciclo, 2 ciclos
      expect(totais.presencial).toBe((n - k) * 2)
    }
  })

  it('não gera blocos sobrepostos e cobre todos os dias úteis para cada participante', () => {
    const n = 3
    const blocos = construirBlocosHibrido({
      participantes: participantes(n),
      dataInicio: '2026-01-01',
      dataFim: '2026-01-15',
      diasTrabalho: [1, 2, 3, 4, 5], // seg a sex
      percentualHomeOffice: 33,
    })
    for (let t = 0; t < n; t++) {
      const blocosDoParticipante = blocos.filter(b => b.tecnicoUid === `uid-${t}`)
      const totalDias = blocosDoParticipante.reduce((acc, b) => acc + diasNoBloco(b.dtInicio, b.dtFim), 0)
      // conta manualmente quantos dias úteis existem no período
      let count = 0
      let cursor = '2026-01-01'
      while (cursor <= '2026-01-15') {
        const [y, m, d] = cursor.split('-').map(Number)
        const dow = new Date(y, m - 1, d).getDay()
        if ([1, 2, 3, 4, 5].includes(dow) && !ehFeriado(cursor)) count++
        cursor = addDays(cursor, 1)
      }
      expect(totalDias).toBe(count)
    }
  })

  it('quem está de férias num dia específico não recebe escala nesse dia (nem presencial nem home office)', () => {
    const dois = participantes(2)
    dois[0].feriasInicio = '2026-01-06'
    dois[0].feriasFim = '2026-01-07'

    const blocos = construirBlocosHibrido({
      participantes: dois,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-09',
      diasTrabalho: [0, 1, 2, 3, 4, 5, 6],
      percentualHomeOffice: 50,
    })

    const diasCobertosUid0 = blocos
      .filter(b => b.tecnicoUid === 'uid-0')
      .flatMap(b => {
        const dias = []
        let cursor = b.dtInicio
        while (cursor <= b.dtFim) { dias.push(cursor); cursor = addDays(cursor, 1) }
        return dias
      })
    expect(diasCobertosUid0).not.toContain('2026-01-06')
    expect(diasCobertosUid0).not.toContain('2026-01-07')
    expect(diasCobertosUid0).toEqual(expect.arrayContaining(['2026-01-05', '2026-01-08', '2026-01-09']))
  })
})
