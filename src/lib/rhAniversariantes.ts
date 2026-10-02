import 'server-only'

// GET /ti/aniversariantes (colaboradorRHApi) devolve a VIEW INTEIRA da TI
// (FJS.VW_TIME, ~70 pessoas), sem filtro de data nenhum — quem filtra por
// "aniversariante do mês/hoje" é o Organiza (ver /api/integracao/
// aniversariantes). Confirmado batendo no endpoint de verdade: tem
// DTNASCIMENTO (data de nascimento real) e DIAANIVERSARIO (a mesma data
// recalculada pro ano corrente/próximo — não usamos esse, DTNASCIMENTO
// sozinho já basta pra comparar mês/dia).
//
// Por ser a lista completa da TI (não só quem está de férias, como o
// /ti/ferias), também é reaproveitada por lib/sincronizarUsuariosGau.ts
// pra saber o TIME (equipe) de cada matrícula.

export class RhAniversariantesIndisponivelError extends Error {}

export interface AniversarianteTiRh {
  chapa: string
  nome: string
  time: string
  cargo: string
  dtNascimento: string
  idade: number
}

function paraDataISO(valor: unknown): string {
  return String(valor ?? '').slice(0, 10)
}

export async function buscarAniversariantesTiRh(): Promise<AniversarianteTiRh[]> {
  const baseUrl = process.env.GATEWAY_URL || 'https://portal.fjs.org.br/gateway'
  const apiKey = process.env.GATEWAY_API_KEY

  if (!apiKey) {
    console.error('[rh-aniversariantes] GATEWAY_API_KEY não configurada no .env.local')
    throw new RhAniversariantesIndisponivelError()
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/ti/aniversariantes`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('[rh-aniversariantes] falha ao chamar /ti/aniversariantes:', error instanceof Error ? error.message : error)
    throw new RhAniversariantesIndisponivelError()
  }

  if (!response.ok) {
    console.error('[rh-aniversariantes] /ti/aniversariantes respondeu', response.status)
    throw new RhAniversariantesIndisponivelError()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await response.json()) as any[]
  if (!Array.isArray(data)) return []

  return data.map(item => ({
    chapa: String(item.CHAPA ?? '').trim(),
    nome: String(item.NOME ?? '').trim(),
    time: String(item.TIME ?? '').trim(),
    cargo: String(item.CARGO ?? '').trim(),
    dtNascimento: paraDataISO(item.DTNASCIMENTO),
    idade: Number(item.IDADE) || 0,
  }))
}
