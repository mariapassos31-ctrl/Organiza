import type { Participante } from './tipos'
import { describe, it, expect } from 'vitest'
import { construirBlocosHomeOfficePar } from './escalasHomeOfficePar'
import { addDays } from './escalasRodizio'

function participante(i: number, overrides: Partial<Participante> = {}) {
  return {
    cd_usuario: `uid-${i}`,
    cd_tecnico: `t-${i}`,
    nm_tecnico: `Tecnico ${i}`,
    role: 'tecnico',
    especialidade: null,
    horarioEntrada: null,
    baiaId: null,
    ...overrides,
  }
}

function diasNoBloco(dtInicio: string, dtFim: string) {
  const [y1, m1, d1] = dtInicio.split('-').map(Number)
  const [y2, m2, d2] = dtFim.split('-').map(Number)
  const inicio = new Date(y1, m1 - 1, d1)
  const fim = new Date(y2, m2 - 1, d2)
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1
}

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6]

describe('construirBlocosHomeOfficePar', () => {
  it('retorna vazio quando nenhum dia do período é dia de trabalho', () => {
    const resultado = construirBlocosHomeOfficePar({
      participantes: [participante(0), participante(1), participante(2)],
      dataInicio: '2026-01-03',
      dataFim: '2026-01-04',
      diasTrabalho: [1, 2, 3, 4, 5],
      quantidadeHomeOffice: 1,
    })
    expect(resultado.blocos).toEqual([])
    expect(resultado.avisos).toEqual([])
  })

  it('coloca sempre exatamente K pessoas em home office por dia', () => {
    const participantes = [0, 1, 2, 3, 4].map(i => participante(i))
    const dataFim = addDays('2026-01-05', 9)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    for (let dia = 0; dia < 10; dia++) {
      const data = addDays('2026-01-05', dia)
      const emHomeOfficeNesseDia = resultado.blocos.filter(
        b => b.tipo === 'homeoffice' && b.dtInicio <= data && data <= b.dtFim
      )
      expect(emHomeOfficeNesseDia).toHaveLength(2)
    }
  })

  it('quem entra às 07:00 pode ir para home office normalmente', () => {
    const participantes = [
      participante(0, { horarioEntrada: '07:00' }),
      participante(1),
      participante(2),
      participante(3),
    ]
    const dataFim = addDays('2026-01-05', 13)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const blocosDoTecnico0EmHO = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'homeoffice')
    expect(blocosDoTecnico0EmHO.length).toBeGreaterThan(0)
  })

  it('nunca coloca 2 pessoas que entram às 07:00 juntas em home office no mesmo dia', () => {
    const participantes = [
      participante(0, { horarioEntrada: '07:00' }),
      participante(1, { horarioEntrada: '07:00' }),
      participante(2),
      participante(3),
    ]
    const dataFim = addDays('2026-01-05', 13)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    for (let dia = 0; dia < 14; dia++) {
      const data = addDays('2026-01-05', dia)
      const uidsEmHO = resultado.blocos
        .filter(b => b.tipo === 'homeoffice' && b.dtInicio <= data && data <= b.dtFim)
        .map(b => b.tecnicoUid)
      const quantosAs7 = uidsEmHO.filter(uid => uid === 'uid-0' || uid === 'uid-1').length
      expect(quantosAs7).toBeLessThanOrEqual(1)
    }
  })

  it('nunca escala perfil Estag/Aprendiz para home office', () => {
    const participantes = [
      participante(0, { role: 'estagiario_aprendiz' }),
      participante(1),
      participante(2),
      participante(3),
    ]
    const dataFim = addDays('2026-01-05', 13)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const blocosDoAprendizEmHO = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'homeoffice')
    expect(blocosDoAprendizEmHO).toEqual([])
    // ele continua presencial normalmente nos dias de trabalho
    const blocosDoAprendizPresencial = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'presencial')
    expect(blocosDoAprendizPresencial.length).toBeGreaterThan(0)
  })

  it('nunca escala perfil Trainee para home office (mesma categoria de Estag/Aprendiz)', () => {
    const participantes = [
      participante(0, { role: 'trainee' }),
      participante(1),
      participante(2),
      participante(3),
    ]
    const dataFim = addDays('2026-01-05', 13)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const blocosDoEstagiarioEmHO = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'homeoffice')
    expect(blocosDoEstagiarioEmHO).toEqual([])
  })

  it('nunca escala quem está na baia 0 (Supervisor) para home office', () => {
    const participantes = [
      participante(0, { baiaId: 0 }),
      participante(1),
      participante(2),
      participante(3),
    ]
    const dataFim = addDays('2026-01-05', 13)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const blocosDoSupervisorEmHO = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'homeoffice')
    expect(blocosDoSupervisorEmHO).toEqual([])
  })

  it('nunca escala quem está marcado manualmente como não elegível para home office', () => {
    const participantes = [
      participante(0, { elegivelHomeOffice: false }),
      participante(1),
      participante(2),
      participante(3),
    ]
    const dataFim = addDays('2026-01-05', 13)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const blocosDoNaoElegivelEmHO = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'homeoffice')
    expect(blocosDoNaoElegivelEmHO).toEqual([])
    const blocosDoNaoElegivelPresencial = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'presencial')
    expect(blocosDoNaoElegivelPresencial.length).toBeGreaterThan(0)
  })

  it('especialidade Externo só aparece na escala nos dias em que está de home office (nunca presencial)', () => {
    const participantes = [
      participante(0, { especialidade: 'Externo' }),
      participante(1),
      participante(2),
      participante(3),
    ]
    const dataFim = addDays('2026-01-05', 13)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const blocosDoExterno = resultado.blocos.filter(b => b.tecnicoUid === 'uid-0')
    expect(blocosDoExterno.length).toBeGreaterThan(0)
    expect(blocosDoExterno.every(b => b.tipo === 'homeoffice')).toBe(true)

    const diasCobertos = blocosDoExterno.reduce((total, b) => total + diasNoBloco(b.dtInicio, b.dtFim), 0)
    expect(diasCobertos).toBeLessThan(14)
  })

  it('nunca coloca 2 pessoas da mesma especialidade em H.O. no mesmo dia', () => {
    const participantes = [
      participante(0, { especialidade: 'Redes' }),
      participante(1, { especialidade: 'Redes' }),
      participante(2, { especialidade: 'Manutenção' }),
      participante(3, { especialidade: 'Sistemas N1' }),
    ]
    const dataFim = addDays('2026-01-05', 19)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    for (let dia = 0; dia < 20; dia++) {
      const data = addDays('2026-01-05', dia)
      const uidsEmHO = resultado.blocos
        .filter(b => b.tipo === 'homeoffice' && b.dtInicio <= data && data <= b.dtFim)
        .map(b => b.tecnicoUid)
      const especialidadesDoDia = uidsEmHO.map(uid => participantes.find(p => p.cd_usuario === uid)?.especialidade)
      expect(new Set(especialidadesDoDia).size).toBe(especialidadesDoDia.length)
    }
  })

  it('emite aviso e não escala ninguém no dia em que é impossível respeitar a regra de especialidade', () => {
    // Só 1 especialidade distinta disponível para um grupo de 2 -> impossível
    const participantes = [
      participante(0, { especialidade: 'Redes' }),
      participante(1, { especialidade: 'Redes' }),
    ]
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    expect(resultado.blocos.some(b => b.tipo === 'homeoffice')).toBe(false)
    expect(resultado.avisos).toHaveLength(1)
    expect(resultado.avisos[0].mensagem).toMatch(/especialidade/)
  })

  it('evita colocar a mesma dupla de baia em H.O. junta quando há alternativa', () => {
    const participantes = [
      participante(0, { baiaId: 1 }),
      participante(1, { baiaId: 1 }),
      participante(2, { baiaId: 2 }),
      participante(3, { baiaId: 2 }),
    ]
    const dataFim = addDays('2026-01-05', 9)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    for (let dia = 0; dia < 10; dia++) {
      const data = addDays('2026-01-05', dia)
      const uidsEmHO = resultado.blocos
        .filter(b => b.tipo === 'homeoffice' && b.dtInicio <= data && data <= b.dtFim)
        .map(b => b.tecnicoUid)
      const baiasDoDia = uidsEmHO.map(uid => participantes.find(p => p.cd_usuario === uid)?.baiaId)
      expect(new Set(baiasDoDia).size).toBe(baiasDoDia.length)
    }
    expect(resultado.avisos).toEqual([])
  })

  it('avisa (mas não bloqueia) quando é inevitável colocar a mesma dupla junta', () => {
    // Só existem 2 pessoas elegíveis no total, e elas são a mesma dupla de baia
    const participantes = [
      participante(0, { baiaId: 1 }),
      participante(1, { baiaId: 1 }),
    ]
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const emHO = resultado.blocos.filter(b => b.tipo === 'homeoffice')
    expect(emHO).toHaveLength(2)
    expect(resultado.avisos).toHaveLength(1)
    expect(resultado.avisos[0].mensagem).toMatch(/dupla/)
  })

  it('mantém o rodízio justo: ao longo de vários ciclos, todo mundo acumula H.O. parecido', () => {
    const participantes = [0, 1, 2, 3].map(i => participante(i))
    const dataFim = addDays('2026-01-05', 15) // 16 dias, K=2, 4 pessoas -> 8 "vagas" cada uma, 32 vagas / 4 = 8 cada
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })

    const totalPorPessoa: Record<string, number> = {}
    for (const b of resultado.blocos) {
      if (b.tipo !== 'homeoffice') continue
      totalPorPessoa[b.tecnicoUid!] = (totalPorPessoa[b.tecnicoUid!] || 0) + diasNoBloco(b.dtInicio, b.dtFim)
    }
    for (const uid of ['uid-0', 'uid-1', 'uid-2', 'uid-3']) {
      expect(totalPorPessoa[uid]).toBe(8)
    }
  })

  it('continua o rodízio a partir das contagens iniciais (histórico anterior)', () => {
    const participantes = [0, 1].map(i => participante(i))
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 1,
      contagensIniciais: { 'uid-0': 10, 'uid-1': 0 },
    })

    const emHO = resultado.blocos.filter(b => b.tipo === 'homeoffice')
    expect(emHO).toHaveLength(1)
    expect(emHO[0].tecnicoUid).toBe('uid-1')
  })

  it('junta dias seguidos da mesma pessoa no mesmo tipo num único bloco contíguo', () => {
    const participantes = [0, 1].map(i => participante(i))
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 1,
      contagensIniciais: { 'uid-0': 0, 'uid-1': 100 },
    })
    // uid-0 sempre ganha (menor contagem sempre), então ao rodar vários dias
    // seguidos ele deveria ficar num único bloco contíguo de H.O.
    const maisDias = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: addDays('2026-01-05', 4),
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 1,
      contagensIniciais: { 'uid-0': 0, 'uid-1': 100 },
    })
    const blocosHOdoUid0 = maisDias.blocos.filter(b => b.tecnicoUid === 'uid-0' && b.tipo === 'homeoffice')
    expect(blocosHOdoUid0).toHaveLength(1)
    expect(blocosHOdoUid0[0].dtInicio).toBe('2026-01-05')
    expect(blocosHOdoUid0[0].dtFim).toBe(addDays('2026-01-05', 4))
  })

  it('quem está de férias num dia não recebe bloco nesse dia (nem H.O. nem presencial)', () => {
    const participantes = [
      participante(0, { feriasInicio: '2026-01-02', feriasFim: '2026-01-03' }),
      participante(1),
      participante(2),
    ]
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 1,
    })

    const diasCobertosUid0 = resultado.blocos
      .filter(b => b.tecnicoUid === 'uid-0')
      .flatMap(b => {
        const dias = []
        let cursor = b.dtInicio
        while (cursor <= b.dtFim) { dias.push(cursor); cursor = addDays(cursor, 1) }
        return dias
      })
    expect(diasCobertosUid0).not.toContain('2026-01-02')
    expect(diasCobertosUid0).not.toContain('2026-01-03')
  })

  it('respeita ocupação já existente (de uma geração anterior) e não passa do limite diário', () => {
    const participantes = [0, 1, 2].map(i => participante(i))
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
      ocupacaoExistentePorDia: { '2026-01-05': 2 }, // já tem 2 de outra geração
    })

    expect(resultado.blocos.filter(b => b.tipo === 'homeoffice')).toEqual([])
    expect(resultado.avisos).toHaveLength(1)
    expect(resultado.avisos[0].mensagem).toMatch(/já tem pessoa/)
  })

  it('completa só as vagas restantes quando já existe ocupação parcial', () => {
    const participantes = [0, 1, 2, 3].map(i => participante(i))
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim: '2026-01-05',
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
      ocupacaoExistentePorDia: { '2026-01-05': 1 }, // já tem 1 de outra geração
    })

    expect(resultado.blocos.filter(b => b.tipo === 'homeoffice')).toHaveLength(1)
  })

  it('com duracaoBlocoDias, a mesma dupla fica em H.O. por vários dias seguidos antes de trocar', () => {
    const participantes = [0, 1, 2, 3].map(i => participante(i))
    const dataFim = addDays('2026-01-05', 8) // 9 dias, blocos de 3 -> 3 blocos
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
      duracaoBlocoDias: 3,
    })

    // pra cada participante, cada bloco de H.O. dele deve durar exatamente
    // 3 dias (ou terminar no fim do período) — nunca trocar no meio do bloco
    const blocosHO = resultado.blocos.filter(b => b.tipo === 'homeoffice')
    for (const b of blocosHO) {
      const dias = diasNoBloco(b.dtInicio, b.dtFim)
      expect(dias).toBeLessThanOrEqual(3)
    }
    // ainda respeita exatamente 2 por dia
    for (let dia = 0; dia < 9; dia++) {
      const data = addDays('2026-01-05', dia)
      const emHO = resultado.blocos.filter(b => b.tipo === 'homeoffice' && b.dtInicio <= data && data <= b.dtFim)
      expect(emHO).toHaveLength(2)
    }
  })

  it('duracaoBlocoDias padrão (1) continua igual ao comportamento anterior, escolhendo todo dia', () => {
    const participantes = [0, 1, 2, 3].map(i => participante(i))
    const dataFim = addDays('2026-01-05', 3)
    const resultado = construirBlocosHomeOfficePar({
      participantes,
      dataInicio: '2026-01-05',
      dataFim,
      diasTrabalho: TODOS_OS_DIAS,
      quantidadeHomeOffice: 2,
    })
    for (let dia = 0; dia < 4; dia++) {
      const data = addDays('2026-01-05', dia)
      const emHO = resultado.blocos.filter(b => b.tipo === 'homeoffice' && b.dtInicio <= data && data <= b.dtFim)
      expect(emHO).toHaveLength(2)
    }
  })
})
