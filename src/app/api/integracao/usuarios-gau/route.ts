import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { mensagemDeErro } from '../../../../lib/erros'
import { prevSincronizacaoUsuariosGau, aplicarSincronizacaoUsuariosGau } from '../../../../lib/sincronizarUsuariosGau'

// A sincronização roda sozinha: o layout do dashboard (src/app/dashboard/
// layout.tsx) chama o POST daqui de tempos em tempos enquanto um admin está
// com a tela aberta — sem cron externo, sem botão. O GET fica pra inspeção
// manual (ex: no console do navegador) se precisar conferir a prévia.
async function exigirAdmin() {
  const session = await auth()
  if (!session?.user) return { erro: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if (session.user.role !== 'admin') {
    return { erro: NextResponse.json({ error: 'Permissão negada' }, { status: 403 }) }
  }
  return { session }
}

export async function GET() {
  const { erro } = await exigirAdmin()
  if (erro) return erro

  try {
    return NextResponse.json(await prevSincronizacaoUsuariosGau())
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}

export async function POST() {
  const { erro } = await exigirAdmin()
  if (erro) return erro

  try {
    return NextResponse.json(await aplicarSincronizacaoUsuariosGau())
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
