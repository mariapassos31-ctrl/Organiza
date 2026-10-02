import 'server-only'

// Importação de férias direto do RM (via colaboradorRHApi, atrás do mesmo
// gateway/apikey do login unificado) — substitui, aos poucos, a importação
// manual por Excel mencionada em sql/023_tecnico_ferias.sql ("Excel hoje,
// TOTVS depois"). Só lê quem está de férias AGORA (o endpoint já filtra por
// TRUNC(SYSDATE) BETWEEN dt_inicio e dt_fim — ver colaboradorRHApi/api/src/
// modules/ti/ti.service.ts), não o histórico nem férias futuras.

export class RhFeriasIndisponivelError extends Error {}

export interface FeriasTiRh {
  chapa: string
  nome: string
  time: string
  cargo: string
  dataInicio: string
  dataFim: string
  nroDiasFerias: number
}

// O Oracle/NestJS devolve as datas como ISO completo (ex: "2026-10-05T00:00:00.000Z")
// — aqui só interessa a parte do dia, sem fuso (evita o clássico "um dia a
// menos/a mais" de usar `new Date(...)` com timezone).
function paraDataISO(valor: unknown): string {
  return String(valor ?? '').slice(0, 10)
}

export async function buscarFeriasTiRh(): Promise<FeriasTiRh[]> {
  const baseUrl = process.env.GATEWAY_URL || 'https://portal.fjs.org.br/gateway'
  const apiKey = process.env.GATEWAY_API_KEY

  if (!apiKey) {
    console.error('[rh-ferias] GATEWAY_API_KEY não configurada no .env.local')
    throw new RhFeriasIndisponivelError()
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/ti/ferias`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('[rh-ferias] falha ao chamar /ti/ferias:', error instanceof Error ? error.message : error)
    throw new RhFeriasIndisponivelError()
  }

  if (!response.ok) {
    console.error('[rh-ferias] /ti/ferias respondeu', response.status)
    throw new RhFeriasIndisponivelError()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as any[]
  if (!Array.isArray(data)) return []

  return data.map(item => ({
    chapa: String(item.CHAPA ?? '').trim(),
    nome: String(item.NOME ?? '').trim(),
    time: String(item.TIME ?? '').trim(),
    cargo: String(item.CARGO ?? '').trim(),
    dataInicio: paraDataISO(item.DATAINICIO),
    dataFim: paraDataISO(item.DATAFIM),
    nroDiasFerias: Number(item.NRODIASFERIAS) || 0,
  }))
}
