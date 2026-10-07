import { describe, it, expect } from 'vitest'
import { calcularOcupacaoBaias, calcularOcupantesJovemAprendiz } from './ocupacaoBaias'
import type { Escala, Usuario } from '../types/dominio'

function criarUsuario(parcial: Partial<Usuario> & { uid: string; nome: string }): Usuario {
  return {
    email: '',
    role: 'tecnico',
    equipe: 'suporte',
    matricula: '',
    especialidade: '',
    horarioEntrada: '',
    baia: '',
    baiaFixa: false,
    elegivelHomeOffice: true,
    ehSupervisor: false,
    ehAprendiz: false,
    diaCurso: null,
    feriasInicio: '',
    feriasFim: '',
    ativo: true,
    criadoEm: '',
    ...parcial,
  }
}

function criarEscalaPresencial(uid: string): Escala {
  return {
    id: `escala-${uid}`,
    tipo: 'presencial',
    dataInicio: '2026-09-28',
    dataFim: '2026-09-28',
    tecnicos: [uid],
    equipe: 'suporte',
    descricao: null,
    status: 'ativa',
    criadoPor: null,
    dataCriacao: '',
    salaId: null,
  }
}

describe('calcularOcupacaoBaias', () => {
  // Reproduz o caso real: baia 1 rotulada "analista" na config da sala,
  // mas o técnico fixo nela é "lider" — antes da correção, esse rótulo
  // (puramente informativo) bloqueava a baia fixa por engano, e a pessoa
  // caía no rodízio normal, aparecendo em outra baia.
  it('baia fixa funciona mesmo quando o rótulo da sala é de um perfil comum diferente do técnico', () => {
    const sergio = criarUsuario({ uid: 'sergio', nome: 'Sergio', role: 'lider', baia: '1', baiaFixa: true })
    const jeovane = criarUsuario({ uid: 'jeovane', nome: 'Jeovane', role: 'tecnico' })
    const baiasPerfil = { '1': 'analista', '2': 'lider' }
    const escalas = [criarEscalaPresencial('sergio'), criarEscalaPresencial('jeovane')]

    const { ocupantes } = calcularOcupacaoBaias(escalas, [sergio, jeovane], new Date(2026, 8, 28), baiasPerfil, null, null)

    expect(ocupantes['1']).toBe('Sergio')
  })

  // Baia reservada a Estag/Aprendiz, Trainee ou Supervisor continua
  // exclusiva de verdade — baia fixa configurada errado ali não deve
  // valer, porque essas baias têm sistema de turno/marcação próprio.
  it('baia fixa NÃO funciona numa baia reservada a Estag/Aprendiz/Trainee/Supervisor', () => {
    const tecnico = criarUsuario({ uid: 't1', nome: 'Fulano', role: 'tecnico', baia: '7', baiaFixa: true })
    const baiasPerfil = { '7': 'estagiario_aprendiz' }
    const escalas = [criarEscalaPresencial('t1')]

    const { ocupantes } = calcularOcupacaoBaias(escalas, [tecnico], new Date(2026, 8, 28), baiasPerfil, null, null)

    expect(ocupantes['7']).not.toBe('Fulano')
  })

  // Baia sem nenhum rótulo reservado — caso comum, continua funcionando.
  it('baia fixa funciona numa baia sem nenhum perfil reservado', () => {
    const tecnico = criarUsuario({ uid: 't1', nome: 'Fulano', role: 'tecnico', baia: '5', baiaFixa: true })
    const escalas = [criarEscalaPresencial('t1')]

    const { ocupantes } = calcularOcupacaoBaias(escalas, [tecnico], new Date(2026, 8, 28), {}, null, null)

    expect(ocupantes['5']).toBe('Fulano')
  })
})

describe('calcularOcupantesJovemAprendiz', () => {
  // Caso real: 3 Estag/Aprendiz entrando às 08:00 (mesmo turno), só 2
  // baias reservadas — Estag/Aprendiz não tem limite de 1 pessoa por turno
  // por baia, então os 3 precisam aparecer, não só 2.
  it('não limita a 1 pessoa por turno por baia — todo mundo com escala aparece', () => {
    const pessoas = [
      criarUsuario({ uid: 'a', nome: 'Rodrigo', role: 'estagiario_aprendiz', horarioEntrada: '08:00' }),
      criarUsuario({ uid: 'b', nome: 'Samuel', role: 'estagiario_aprendiz', horarioEntrada: '08:00' }),
      criarUsuario({ uid: 'c', nome: 'Yasmim', role: 'estagiario_aprendiz', horarioEntrada: '08:00' }),
    ]
    const baiasPerfil = { '7': 'estagiario_aprendiz', '8': 'estagiario_aprendiz' }
    const uidsPresencialHoje = new Set(['a', 'b', 'c'])

    const resultado = calcularOcupantesJovemAprendiz(pessoas, uidsPresencialHoje, new Set(), baiasPerfil)

    const todosOcupantes = [...resultado['7'], ...resultado['8']]
    expect(todosOcupantes.map(o => o.nome).sort()).toEqual(['Rodrigo', 'Samuel', 'Yasmim'])
  })

  it('quem está no próprio dia de curso não aparece em baia nenhuma', () => {
    const pessoas = [criarUsuario({ uid: 'a', nome: 'Rodrigo', role: 'estagiario_aprendiz', horarioEntrada: '08:00' })]
    const baiasPerfil = { '7': 'estagiario_aprendiz' }

    const resultado = calcularOcupantesJovemAprendiz(pessoas, new Set(['a']), new Set(['a']), baiasPerfil)

    expect(resultado['7']).toEqual([])
  })
})
