import { describe, it, expect } from 'vitest'
import { ehJovemAprendiz, estaEmDiaCurso } from './escalasConstants'

describe('ehJovemAprendiz', () => {
  it('reconhece Aprendiz e Estagiário como a mesma categoria', () => {
    expect(ehJovemAprendiz('Aprendiz')).toBe(true)
    expect(ehJovemAprendiz('Estagiário')).toBe(true)
  })

  it('não reconhece outras especialidades nem valores vazios', () => {
    expect(ehJovemAprendiz('Redes')).toBe(false)
    expect(ehJovemAprendiz(null)).toBe(false)
    expect(ehJovemAprendiz(undefined)).toBe(false)
  })
})

describe('estaEmDiaCurso', () => {
  const quarta = new Date(2026, 0, 7) // quarta-feira

  it('usa o sinalizador ehAprendiz (não o texto da especialidade)', () => {
    const usuario = { ehAprendiz: true, diaCurso: 3 }
    expect(estaEmDiaCurso(usuario, quarta)).toBe(true)
  })

  it('retorna false se ehAprendiz for falso, mesmo com diaCurso configurado', () => {
    const usuario = { ehAprendiz: false, diaCurso: 3 }
    expect(estaEmDiaCurso(usuario, quarta)).toBe(false)
  })

  it('retorna false sem diaCurso configurado', () => {
    const usuario = { ehAprendiz: true, diaCurso: null }
    expect(estaEmDiaCurso(usuario, quarta)).toBe(false)
  })

  it('retorna false num dia da semana diferente do configurado', () => {
    const usuario = { ehAprendiz: true, diaCurso: 1 }
    expect(estaEmDiaCurso(usuario, quarta)).toBe(false)
  })
})
