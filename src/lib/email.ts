import nodemailer, { type Transporter } from 'nodemailer'
import { timingSafeEqual } from 'crypto'

// Nunca confia em texto que acaba em cabeçalho/HTML sem passar por aqui —
// tira quebra de linha (evita injeção de cabeçalho SMTP) e escapa HTML.
function sanitizarLinhaUnica(s: string): string {
  return s.replace(/[\r\n]+/g, ' ')
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Comparação em tempo constante — evita que diferenças no tempo de
// resposta entre "quase certo" e "muito errado" ajudem alguém a adivinhar
// um segredo aos poucos. Sem isso, `a !== b` sai mais rápido no primeiro
// caractere diferente.
export function compararSegredo(recebido: string | null, esperado: string | null | undefined): boolean {
  if (!recebido || !esperado) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Envio de e-mail é sempre um efeito colateral de notificação — nunca pode
// derrubar a operação principal (criar escala, trocar, aceitar/recusar).
// Por isso engole qualquer erro aqui e só loga no servidor, em vez de
// propagar pra quem chamou.
//
// Configuração via variável de ambiente (.env.local), apontando pro SMTP do
// Zimbra da empresa:
//   SMTP_HOST=mail.suaempresa.com.br
//   SMTP_PORT=587
//   SMTP_SECURE=false        (true só se a porta for 465/SSL direto)
//   SMTP_USER=escalas@suaempresa.com.br
//   SMTP_PASS=...
//   SMTP_FROM=escalas@suaempresa.com.br   (opcional — usa SMTP_USER se faltar)
// Sem SMTP_HOST/SMTP_USER/SMTP_PASS configurados, o envio fica desativado
// (loga um aviso uma vez) em vez de quebrar a aplicação.
let transporter: Transporter | null | undefined

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[email] SMTP não configurado (SMTP_HOST/SMTP_USER/SMTP_PASS) — notificações por e-mail desativadas')
    transporter = null
    return transporter
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export async function enviarEmail(opcoes: {
  to: string
  subject: string
  html: string
  // Imagens embutidas (ex: mapa da sala) — referenciadas no html como
  // <img src="cid:o-mesmo-cid">, não como link externo.
  attachments?: Array<{ filename: string; content: Buffer; cid: string }>
}): Promise<void> {
  const t = getTransporter()
  if (!t) return

  // Modo teste: com EMAIL_TESTE_PARA definido no .env.local, TODO e-mail
  // (de qualquer rota — troca, escala, resumo semanal) vai só pra esse
  // endereço, nunca pro destinatário de verdade. O assunto e o corpo dizem
  // quem seria o destinatário real, pra dar pra conferir cada cenário.
  // Tirar essa variável do .env.local volta ao envio normal.
  const modoTeste = process.env.EMAIL_TESTE_PARA
  const to = modoTeste || opcoes.to
  const subject = modoTeste ? `[TESTE → ${sanitizarLinhaUnica(opcoes.to)}] ${sanitizarLinhaUnica(opcoes.subject)}` : sanitizarLinhaUnica(opcoes.subject)
  // opcoes.html é o documento inteiro (<!doctype html>...) — o aviso entra
  // logo depois do <body>, nunca antes do <!doctype>, senão quebra o HTML.
  const html = modoTeste
    ? opcoes.html.replace(
        /<body[^>]*>/,
        match => `${match}<div style="background:#fff3cd; color:#664d03; padding:10px 16px; font-family:Arial,sans-serif; font-size:13px; border-bottom:2px solid #ffe69c;">🧪 Modo teste — este e-mail seria enviado pra <strong>${escapeHtml(opcoes.to)}</strong></div>`
      )
    : opcoes.html

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      attachments: opcoes.attachments,
    })
  } catch (error) {
    console.error('[email] Falha ao enviar e-mail:', error)
  }
}
