import { describe, it, expect } from 'vitest'
import { substituirTecnicoNoPeriodo, isolarDiasComoEscalaPropria } from './escalaSegmento'
import type { PoolClient } from 'pg'

// Cliente falso: simula uma tabela "escalas" em memória o suficiente pra
// verificar o resultado final de UPDATE/INSERT sem precisar de um banco de
// verdade. Cada registro guarda { dt_inicio, dt_fim, tecnico }.
function criarClienteFake() {
  let proximoId = 100
  const escalas: Record<string, { dt_inicio: string; dt_fim: string; tecnico: unknown }> = {
    1: { dt_inicio: '2026-09-28', dt_fim: '2026-09-30', tecnico: 'A' },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = async (sql: string, params: any[]) => {
    if (sql.startsWith('INSERT INTO escalas')) {
      const [, , dtInicio, dtFim] = params
      const id = proximoId++
      escalas[id] = { dt_inicio: dtInicio, dt_fim: dtFim, tecnico: null }
      return { rows: [{ cd_escala: id }] }
    }
    if (sql.startsWith('INSERT INTO escala_tecnicos')) {
      const [cdEscala, cdTecnico] = params
      escalas[cdEscala].tecnico = cdTecnico
      return { rows: [] }
    }
    if (sql.startsWith('UPDATE escalas SET dt_inicio')) {
      const [dtInicio, dtFim, cdEscala] = params
      escalas[cdEscala].dt_inicio = dtInicio
      escalas[cdEscala].dt_fim = dtFim
      return { rows: [] }
    }
    if (sql.startsWith('UPDATE escala_tecnicos SET cd_tecnico')) {
      const [cdTecnicoNovo, cdEscala, cdTecnicoAntigo] = params
      if (escalas[cdEscala].tecnico === cdTecnicoAntigo) escalas[cdEscala].tecnico = cdTecnicoNovo
      return { rows: [] }
    }
    throw new Error('SQL não esperado no teste: ' + sql)
  }

  return { client: { query } as unknown as PoolClient, escalas }
}

const escalaBase = {
  cd_escala: 1,
  tp_escala: 'homeoffice',
  cd_equipe: 1,
  ds_descricao: null,
  tp_status: 'ativa',
  cd_usuario_criador: null,
  dt_inicio: '2026-09-28',
  dt_fim: '2026-09-30',
}

// Devolve, pra cada dia do período, quem ficou com ele — junta os
// registros da fake tabela num mapa dia -> técnico, fácil de comparar.
function mapaPorDia(escalas: Record<string, { dt_inicio: string; dt_fim: string; tecnico: unknown }>) {
  const mapa: Record<string, unknown> = {}
  for (const registro of Object.values(escalas)) {
    if (!registro.tecnico) continue
    for (let d = registro.dt_inicio; d <= registro.dt_fim; d = proximoDia(d)) {
      mapa[d] = registro.tecnico
    }
  }
  return mapa
}

function proximoDia(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

describe('substituirTecnicoNoPeriodo', () => {
  it('sem dias específicos, troca a escala inteira', async () => {
    const { client, escalas } = criarClienteFake()
    await substituirTecnicoNoPeriodo(client, escalaBase, null, 'A', 'B')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'B', '2026-09-29': 'B', '2026-09-30': 'B',
    })
  })

  it('escolhendo todos os dias do período, equivale a trocar a escala inteira', async () => {
    const { client, escalas } = criarClienteFake()
    await substituirTecnicoNoPeriodo(client, escalaBase, ['2026-09-28', '2026-09-29', '2026-09-30'], 'A', 'B')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'B', '2026-09-29': 'B', '2026-09-30': 'B',
    })
  })

  it('escolhendo só o primeiro dia, o resto continua com quem saiu', async () => {
    const { client, escalas } = criarClienteFake()
    await substituirTecnicoNoPeriodo(client, escalaBase, ['2026-09-28'], 'A', 'B')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'B', '2026-09-29': 'A', '2026-09-30': 'A',
    })
  })

  it('escolhendo só o último dia, o começo continua com quem saiu', async () => {
    const { client, escalas } = criarClienteFake()
    await substituirTecnicoNoPeriodo(client, escalaBase, ['2026-09-30'], 'A', 'B')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'A', '2026-09-29': 'A', '2026-09-30': 'B',
    })
  })

  it('escolhendo só o dia do meio, quem entrou fica isolado entre dois pedaços de quem saiu', async () => {
    const { client, escalas } = criarClienteFake()
    await substituirTecnicoNoPeriodo(client, escalaBase, ['2026-09-29'], 'A', 'B')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'A', '2026-09-29': 'B', '2026-09-30': 'A',
    })
  })

  it('escolhendo dias não-contíguos (primeiro e último, pulando o do meio)', async () => {
    const { client, escalas } = criarClienteFake()
    await substituirTecnicoNoPeriodo(client, escalaBase, ['2026-09-28', '2026-09-30'], 'A', 'B')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'B', '2026-09-29': 'A', '2026-09-30': 'B',
    })
  })

  it('escolhendo dois dias seguidos no meio de um período maior', async () => {
    const escala5dias = { ...escalaBase, dt_inicio: '2026-09-28', dt_fim: '2026-10-02' }
    const { client, escalas } = criarClienteFake()
    escalas[1] = { dt_inicio: '2026-09-28', dt_fim: '2026-10-02', tecnico: 'A' }
    await substituirTecnicoNoPeriodo(client, escala5dias, ['2026-09-30', '2026-10-01'], 'A', 'B')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'A', '2026-09-29': 'A',
      '2026-09-30': 'B', '2026-10-01': 'B',
      '2026-10-02': 'A',
    })
  })
})

describe('isolarDiasComoEscalaPropria', () => {
  it('sem dias informados, devolve a própria escala sem mexer em nada', async () => {
    const { client, escalas } = criarClienteFake()
    const id = await isolarDiasComoEscalaPropria(client, escalaBase, null, 'A')
    expect(id).toBe(1)
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'A', '2026-09-29': 'A', '2026-09-30': 'A',
    })
  })

  it('escolhendo todos os dias, devolve a própria escala sem recortar', async () => {
    const { client, escalas } = criarClienteFake()
    const id = await isolarDiasComoEscalaPropria(client, escalaBase, ['2026-09-28', '2026-09-29', '2026-09-30'], 'A')
    expect(id).toBe(1)
    expect(Object.keys(escalas)).toEqual(['1'])
  })

  it('isolando só o dia do meio, mantém o mesmo dono nos três pedaços e devolve o id do meio', async () => {
    const { client, escalas } = criarClienteFake()
    const id = await isolarDiasComoEscalaPropria(client, escalaBase, ['2026-09-29'], 'A')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'A', '2026-09-29': 'A', '2026-09-30': 'A',
    })
    expect(escalas[String(id)]).toEqual({ dt_inicio: '2026-09-29', dt_fim: '2026-09-29', tecnico: 'A' })
  })

  it('isolando o primeiro dia, devolve o id da linha original (que agora é só aquele dia)', async () => {
    const { client, escalas } = criarClienteFake()
    const id = await isolarDiasComoEscalaPropria(client, escalaBase, ['2026-09-28'], 'A')
    expect(id).toBe(1)
    expect(escalas['1']).toEqual({ dt_inicio: '2026-09-28', dt_fim: '2026-09-28', tecnico: 'A' })
  })

  it('isolando dois dias seguidos no meio de um período maior', async () => {
    const escala5dias = { ...escalaBase, dt_inicio: '2026-09-28', dt_fim: '2026-10-02' }
    const { client, escalas } = criarClienteFake()
    escalas[1] = { dt_inicio: '2026-09-28', dt_fim: '2026-10-02', tecnico: 'A' }
    const id = await isolarDiasComoEscalaPropria(client, escala5dias, ['2026-09-30', '2026-10-01'], 'A')
    expect(mapaPorDia(escalas)).toEqual({
      '2026-09-28': 'A', '2026-09-29': 'A',
      '2026-09-30': 'A', '2026-10-01': 'A',
      '2026-10-02': 'A',
    })
    expect(escalas[String(id)]).toEqual({ dt_inicio: '2026-09-30', dt_fim: '2026-10-01', tecnico: 'A' })
  })
})
