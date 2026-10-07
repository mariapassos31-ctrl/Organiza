import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { auth } from '../../../../auth'
import { ehPerfilGestao } from '../../../../lib/equipesConfig'
import { enviarResumoSemanalManual } from '../../../../lib/resumoSemanal'

// Botão "Enviar Escala da Semana" (tela de Escalas) — disparo manual pra
// quem tem perfil de gestão, sem depender do agendador externo nem do
// interruptor RESUMO_SEMANAL_ATIVO (esses dois só valem pro envio
// automático). Vai pros e-mails de verdade de quem tem escala na semana —
// com EMAIL_TESTE_PARA configurado no .env.local, todo e-mail do sistema é
// redirecionado pra lá em vez do destinatário real (proteção geral, não só
// desse botão).
export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!ehPerfilGestao(session.user.role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const { segunda, domingo, jaTinhaSidoEnviada } = await enviarResumoSemanalManual()
    return NextResponse.json({ ok: true, semana: { segunda, domingo }, jaTinhaSidoEnviada })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}
