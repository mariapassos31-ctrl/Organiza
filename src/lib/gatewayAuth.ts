import 'server-only'

// Login unificado: a senha é a de rede (AD), validada pelo gateway do Portal
// de Acessos (POST /auth/login) — o mesmo usado pelo Argos. Este sistema não
// guarda nem confere senha nenhuma; só descobre quem a pessoa é.

export class GatewayIndisponivelError extends Error {}

// O JWT vem direto do gateway por HTTPS (server-to-server), então só lemos o
// payload — não há token de terceiros pra validar assinatura aqui.
function lerPayloadJwt(token: string): { username?: string; email?: string } {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'))
  } catch {
    return {}
  }
}

// Devolve { username, email, nome } se as credenciais forem válidas, null se
// forem recusadas, e lança GatewayIndisponivelError se o gateway não responder.
export interface IdentidadeGateway { username: string; email: string | null; nome: string | null }

export async function autenticarNoGateway(username: string, password: string): Promise<IdentidadeGateway | null> {
  const baseUrl = process.env.GATEWAY_URL || 'https://portal.fjs.org.br/gateway'
  const apiKey = process.env.GATEWAY_API_KEY

  if (!apiKey) {
    console.error('[gateway] GATEWAY_API_KEY não configurada no .env.local')
    throw new GatewayIndisponivelError()
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
  } catch (error) {
    console.error('[gateway] falha ao chamar /auth/login:', error instanceof Error ? error.message : error)
    throw new GatewayIndisponivelError()
  }

  if (response.status >= 400 && response.status < 500) return null
  if (!response.ok) {
    console.error('[gateway] /auth/login respondeu', response.status)
    throw new GatewayIndisponivelError()
  }

  const data = await response.json()
  const claims = lerPayloadJwt(data.access_token)

  return {
    username: claims.username || data.user?.username || username,
    email: claims.email || data.user?.email || null,
    nome: data.user?.name || null,
  }
}
