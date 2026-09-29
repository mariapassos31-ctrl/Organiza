import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { auth } from '../../../../../auth'
import { montarPlano, resolverEquipeGestor } from '../../../../../lib/escalasAuto'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  const userEquipe = role !== 'admin' ? await resolverEquipeGestor(session.user) : null
  const body = await request.json()

  try {
    const plano = await montarPlano({ role, userEquipe, body })
    if ('error' in plano) {
      return NextResponse.json({ error: plano.error }, { status: plano.status })
    }

    return NextResponse.json({
      blocos: plano.blocos.map(b => ({
        dataInicio: b.dtInicio,
        dataFim: b.dtFim,
        tecnicoUid: b.tecnicoUid,
        tecnicoNome: b.tecnicoNome,
        tipo: b.tipo,
      })),
      avisos: plano.avisos || [],
    })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}
