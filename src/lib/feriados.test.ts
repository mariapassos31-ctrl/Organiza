import { describe, it, expect } from 'vitest'
import { feriadosDoAno, ehFeriado, nomeFeriado } from './feriados'

describe('feriados', () => {
  it('calcula corretamente os feriados móveis de 2026 (baseados na Páscoa)', () => {
    const datas = feriadosDoAno(2026)
    expect(datas.has('2026-02-16')).toBe(false) // segunda de Carnaval não é feriado
    expect(datas.has('2026-02-17')).toBe(true) // Carnaval (terça)
    expect(datas.has('2026-04-03')).toBe(true) // Sexta-feira Santa
    expect(datas.has('2026-06-04')).toBe(true) // Corpus Christi
  })

  it('só a terça de Carnaval é feriado (não a segunda) em outro ano (2027)', () => {
    const datas = feriadosDoAno(2027)
    expect(datas.has('2027-02-08')).toBe(false) // segunda
    expect(datas.has('2027-02-09')).toBe(true) // terça
  })

  it('inclui os feriados nacionais fixos', () => {
    const datas = feriadosDoAno(2026)
    expect(datas.has('2026-01-01')).toBe(true)
    expect(datas.has('2026-04-21')).toBe(true)
    expect(datas.has('2026-05-01')).toBe(true)
    expect(datas.has('2026-09-07')).toBe(true)
    expect(datas.has('2026-10-12')).toBe(true)
    expect(datas.has('2026-11-02')).toBe(true)
    expect(datas.has('2026-11-15')).toBe(true)
    expect(datas.has('2026-11-20')).toBe(true)
    expect(datas.has('2026-12-25')).toBe(true)
  })

  it('inclui os feriados da Bahia/Salvador', () => {
    const datas = feriadosDoAno(2026)
    expect(datas.has('2026-06-24')).toBe(true) // São João
    expect(datas.has('2026-07-02')).toBe(true) // Independência da Bahia
    expect(datas.has('2026-12-08')).toBe(true) // Nossa Senhora da Conceição da Praia
  })

  it('não marca um dia comum como feriado', () => {
    expect(ehFeriado('2026-03-10')).toBe(false)
  })

  it('ehFeriado reconhece feriado de outro ano corretamente', () => {
    expect(ehFeriado('2027-01-01')).toBe(true)
    expect(ehFeriado('2027-03-10')).toBe(false)
  })

  it('nomeFeriado retorna o nome certo (ou null se não for feriado)', () => {
    expect(nomeFeriado('2026-12-25')).toBe('Natal')
    expect(nomeFeriado('2026-12-08')).toBe('Nossa Senhora da Conceição da Praia')
    expect(nomeFeriado('2026-07-02')).toBe('Independência da Bahia')
    expect(nomeFeriado('2026-03-10')).toBeNull()
  })
})
