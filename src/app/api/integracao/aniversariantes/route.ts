import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { mensagemDeErro } from '../../../../lib/erros'
import { buscarAniversariantesTiRh, RhAniversariantesIndisponivelError } from '../../../../lib/rhAniversariantes'
import type { ItemAniversariante } from '../../../../types/dominio'

// Aniversariantes do mês atual (qualquer pessoa da TI, não só quem tem
// cadastro no Organiza — é informação de time, não de acesso ao sistema),
// ordenados por dia. Qualquer usuário autenticado pode ver.
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const todos = await buscarAniversariantesTiRh()
    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1
    const diaHoje = hoje.getDate()

    const doMes: ItemAniversariante[] = todos
      .filter(p => p.dtNascimento.length === 10 && Number(p.dtNascimento.slice(5, 7)) === mesAtual)
      .map(p => {
        const dia = Number(p.dtNascimento.slice(8, 10))
        return { chapa: p.chapa, nome: p.nome, time: p.time, cargo: p.cargo, dia, idade: p.idade, hoje: dia === diaHoje }
      })
      .sort((a, b) => a.dia - b.dia)

    return NextResponse.json(doMes)
  } catch (error) {
    if (error instanceof RhAniversariantesIndisponivelError) {
      return NextResponse.json({ error: 'Não foi possível consultar aniversariantes agora' }, { status: 502 })
    }
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
