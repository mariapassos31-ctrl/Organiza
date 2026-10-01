import { NextResponse } from 'next/server'
import { enviarResumoSemanalSeNecessario, enviarResumoSemanalTeste } from '../../../../lib/resumoSemanal'
import { compararSegredo } from '../../../../lib/email'

// Disparado por um agendador EXTERNO (Tarefas Agendadas do Windows, cron,
// etc.) de hora em hora — não é uma sessão de usuário, por isso a proteção
// é um segredo compartilhado (CRON_SECRET) em vez de login normal.
export async function POST(request: Request) {
  const segredo = request.headers.get('x-cron-secret')
  if (!compararSegredo(segredo, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  if (searchParams.get('teste') === 'true') {
    // Disparo manual pra testar — ignora dia da semana e "já enviado essa
    // semana", mas só roda se EMAIL_TESTE_PARA estiver configurado, pra
    // nunca mandar de verdade pra todo mundo só por engano de quem chamou.
    if (!process.env.EMAIL_TESTE_PARA) {
      return NextResponse.json({ error: 'Defina EMAIL_TESTE_PARA no .env.local antes de testar — sem isso o teste mandaria e-mail de verdade pra todo mundo' }, { status: 400 })
    }
    const { segunda, domingo } = await enviarResumoSemanalTeste()
    return NextResponse.json({ ok: true, teste: true, semana: { segunda, domingo }, redirecionadoPara: process.env.EMAIL_TESTE_PARA })
  }

  await enviarResumoSemanalSeNecessario()
  return NextResponse.json({ ok: true })
}
