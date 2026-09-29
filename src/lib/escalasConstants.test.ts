import { describe, it, expect } from 'vitest'
import { ehJovemAprendiz, estaEmDiaCurso, motivoInelegibilidadeParaTipo } from './escalasConstants'

describe('ehJovemAprendiz', () => {
  it('reconhece Estag/Aprendiz e Trainee como a mesma categoria', () => {
    expect(ehJovemAprendiz('estagiario_aprendiz')).toBe(true)
    expect(ehJovemAprendiz('trainee')).toBe(true)
  })

  it('não reconhece outros perfis nem valores vazios', () => {
    expect(ehJovemAprendiz('tecnico')).toBe(false)
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

describe('motivoInelegibilidadeParaTipo', () => {
  const tecnico = { role: 'tecnico', ehSupervisor: false, especialidade: 'Redes', elegivelHomeOffice: true }

  it('libera um técnico comum pra qualquer tipo', () => {
    expect(motivoInelegibilidadeParaTipo('presencial', tecnico)).toBeNull()
    expect(motivoInelegibilidadeParaTipo('homeoffice', tecnico)).toBeNull()
    expect(motivoInelegibilidadeParaTipo('sabado', tecnico)).toBeNull()
    expect(motivoInelegibilidadeParaTipo('sobreaviso', tecnico)).toBeNull()
  })

  it('bloqueia o Supervisor em qualquer tipo', () => {
    const supervisor = { ...tecnico, ehSupervisor: true }
    expect(motivoInelegibilidadeParaTipo('presencial', supervisor)).not.toBeNull()
    expect(motivoInelegibilidadeParaTipo('homeoffice', supervisor)).not.toBeNull()
    expect(motivoInelegibilidadeParaTipo('sabado', supervisor)).not.toBeNull()
    expect(motivoInelegibilidadeParaTipo('sobreaviso', supervisor)).not.toBeNull()
  })

  it('bloqueia Estag/Aprendiz e Trainee em home office e sábado, mas libera presencial e sobreaviso', () => {
    for (const role of ['estagiario_aprendiz', 'trainee']) {
      const aprendiz = { ...tecnico, role }
      expect(motivoInelegibilidadeParaTipo('homeoffice', aprendiz)).not.toBeNull()
      expect(motivoInelegibilidadeParaTipo('sabado', aprendiz)).not.toBeNull()
      expect(motivoInelegibilidadeParaTipo('presencial', aprendiz)).toBeNull()
      expect(motivoInelegibilidadeParaTipo('sobreaviso', aprendiz)).toBeNull()
    }
  })

  it('bloqueia quem está marcado como não elegível pra home office', () => {
    const naoElegivel = { ...tecnico, elegivelHomeOffice: false }
    expect(motivoInelegibilidadeParaTipo('homeoffice', naoElegivel)).not.toBeNull()
    expect(motivoInelegibilidadeParaTipo('presencial', naoElegivel)).toBeNull()
  })

  it('bloqueia Analista e Analista G. (lider) em sábado, mas libera outros tipos', () => {
    for (const role of ['analista', 'lider']) {
      const pessoa = { ...tecnico, role }
      expect(motivoInelegibilidadeParaTipo('sabado', pessoa)).not.toBeNull()
      expect(motivoInelegibilidadeParaTipo('homeoffice', pessoa)).toBeNull()
      expect(motivoInelegibilidadeParaTipo('presencial', pessoa)).toBeNull()
    }
  })

  it('bloqueia especialidade Externo em presencial, mas libera home office', () => {
    const externo = { ...tecnico, especialidade: 'Externo' }
    expect(motivoInelegibilidadeParaTipo('presencial', externo)).not.toBeNull()
    expect(motivoInelegibilidadeParaTipo('homeoffice', externo)).toBeNull()
  })
})
