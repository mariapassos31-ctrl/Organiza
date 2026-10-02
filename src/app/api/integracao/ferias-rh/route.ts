import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'
import { mensagemDeErro } from '../../../../lib/erros'
import { prevImportacaoFeriasRh, aplicarImportacaoFeriasRh } from '../../../../lib/importarFeriasRh'
import { RhFeriasIndisponivelError } from '../../../../lib/rhFerias'

// A importação roda sozinha: o layout do dashboard (src/app/dashboard/
// layout.tsx) chama o POST daqui de tempos em tempos enquanto alguém com
// perfil de gestão está com a tela aberta — sem cron externo, sem botão.
// O GET fica pra inspeção manual se precisar conferir a prévia.
async function exigirGestao() {
  const session = await auth()
  if (!session?.user) return { erro: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if (!ehPerfilGestao(session.user.role)) {
    return { erro: NextResponse.json({ error: 'Permissão negada' }, { status: 403 }) }
  }
  return { session }
}

export async function GET() {
  const { erro } = await exigirGestao()
  if (erro) return erro

  try {
    return NextResponse.json(await prevImportacaoFeriasRh())
  } catch (error) {
    if (error instanceof RhFeriasIndisponivelError) {
      return NextResponse.json({ error: 'Não foi possível consultar a API de férias do RH agora' }, { status: 502 })
    }
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}

export async function POST() {
  const { erro } = await exigirGestao()
  if (erro) return erro

  try {
    return NextResponse.json(await aplicarImportacaoFeriasRh())
  } catch (error) {
    if (error instanceof RhFeriasIndisponivelError) {
      return NextResponse.json({ error: 'Não foi possível consultar a API de férias do RH agora' }, { status: 502 })
    }
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
