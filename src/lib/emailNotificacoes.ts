import { enviarEmail } from './email'
import { TIPOS_ESCALA } from './escalasConstants'

interface Destinatario {
  email: string | null | undefined
  nome: string
}

// Nome de técnico e nome de sala são texto livre editável por admin/gestor
// — nunca confiar neles direto dentro do HTML do e-mail (evita que um
// campo com "<"/"&"/aspas quebre o layout ou injete marcação).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function nomeTipoEscala(tipo: string): string {
  if (tipo === 'externo') return 'vaga do Externo (sem escala própria — não ocupa baia)'
  return TIPOS_ESCALA.find(t => t.id === tipo)?.label || tipo
}

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatarPeriodo(dtInicio: string, dtFim: string): string {
  return dtInicio === dtFim ? formatarDataBR(dtInicio) : `${formatarDataBR(dtInicio)} a ${formatarDataBR(dtFim)}`
}

function formatarDias(dias: string[]): string {
  return [...dias].sort().map(formatarDataBR).join(', ')
}

// URL pública do sistema, pra montar os links/botões dentro do e-mail —
// sem isso configurado (ambiente sem APP_URL), cai num link relativo que
// não abre sozinho, mas não quebra o envio.
function appUrl(): string {
  return (process.env.APP_URL || '').replace(/\/$/, '')
}

function linkEscalas(): string {
  return `${appUrl()}/dashboard/escalas`
}

function linkTroca(cdTrocaEscala: string | number): string {
  return `${appUrl()}/dashboard/trocas?trocaId=${encodeURIComponent(String(cdTrocaEscala))}`
}

// Identidade visual do sistema — mesma paleta do app (src/app/globals.css /
// tailwind.config.js) e mesma fonte (Poppins). Layout em tabela (não
// flex/grid) porque é o único jeito que renderiza igual em todo cliente de
// e-mail, Zimbra incluso.
function layout({ titulo, corpo, cta }: { titulo: string; corpo: string; cta?: { texto: string; url: string } }): string {
  const logoUrl = `${appUrl()}/images/logo-fjs.png`
  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
</head>
<body style="margin:0; padding:0; background:#f2f1ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f1ec;">
<tr><td align="center" style="padding: 32px 16px;">
<table role="presentation" width="960" cellpadding="0" cellspacing="0" style="width:960px; max-width:100%; background:#ffffff; border-radius:14px; overflow:hidden; font-family: 'Poppins', Arial, sans-serif;">
<tr>
<td style="background: linear-gradient(135deg, #6c2b3e, #521d30); padding: 28px 32px; text-align:center;">
<img src="${logoUrl}" width="44" height="44" alt="FJS" style="border-radius:10px; display:block; margin:0 auto 10px;">
<span style="color:#ffffff; font-size:15px; font-weight:600; letter-spacing:0.02em;">Sistema de Escalas</span>
</td>
</tr>
<tr>
<td style="padding: 32px 32px 8px;">
<h1 style="margin:0 0 14px; font-size:18px; line-height:1.4; color:#2c2c2c; font-weight:600;">${titulo}</h1>
<div style="font-size:14px; line-height:1.7; color:#475569;">${corpo}</div>
</td>
</tr>
${cta ? `<tr>
<td style="padding: 8px 32px 32px; text-align:center;">
<a href="${cta.url}" style="background:#6c2b3e; color:#ffffff; text-decoration:none; padding:13px 30px; border-radius:8px; font-weight:600; font-size:14px; display:inline-block;">${cta.texto}</a>
</td>
</tr>` : `<tr><td style="padding-bottom: 24px;"></td></tr>`}
<tr>
<td style="padding: 16px 32px; background:#f4e9ec; text-align:center; font-size:12px; color:#6b6b6b;">
Este é um e-mail automático do sistema de escalas — não responda.
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

// Resumo semanal (toda sexta, pra semana seguinte) — substitui o antigo
// aviso imediato de "nova escala" (ver src/lib/resumoSemanal.ts pro porquê).
// Um e-mail só por pessoa, mesmo que ela tenha vários dias/tipos na semana.
export async function notificarResumoSemanal(
  destinatario: Destinatario,
  blocos: Array<{ tipo: string; dtInicio: string; dtFim: string; local?: string | null }>,
  mapaImagem?: Buffer | null
): Promise<void> {
  if (!destinatario.email || blocos.length === 0) return
  const linhas = [...blocos]
    .sort((a, b) => a.dtInicio.localeCompare(b.dtInicio))
    .map(b => `<li>${nomeTipoEscala(b.tipo)} — ${formatarPeriodo(b.dtInicio, b.dtFim)}${b.local ? ` · 📍 ${escapeHtml(b.local)}` : ''}</li>`)
    .join('')
  const mapaHtml = mapaImagem
    ? `<p style="margin:16px 0 6px; font-size:13px; color:#6b6b6b;">Mapa de ocupação da semana:</p><img src="cid:mapa-ocupacao" alt="Mapa de ocupação da sala" width="880" style="width:100%; max-width:880px; height:auto; border-radius:10px; border:1px solid #e2e0d6;">`
    : ''
  await enviarEmail({
    to: destinatario.email,
    subject: 'Sua escala da semana que vem',
    html: layout({
      titulo: 'Sua escala da semana que vem',
      corpo: `<p style="margin:0 0 12px;">Olá, ${escapeHtml(destinatario.nome)}!</p><ul style="margin:0; padding-left:18px;">${linhas}</ul>${mapaHtml}`,
      cta: { texto: 'Ver minha escala', url: linkEscalas() },
    }),
    ...(mapaImagem ? { attachments: [{ filename: 'mapa-ocupacao.png', content: mapaImagem, cid: 'mapa-ocupacao' }] } : {}),
  })
}

// Evento: colega propôs uma troca mútua — precisa aceitar/recusar no sistema.
export async function notificarTrocaSolicitada(destinatario: Destinatario, solicitanteNome: string, cdTrocaEscala: string | number): Promise<void> {
  if (!destinatario.email) return
  await enviarEmail({
    to: destinatario.email,
    subject: 'Pedido de troca de escala',
    html: layout({
      titulo: 'Pedido de troca de escala',
      corpo: `<p style="margin:0;">Olá, ${escapeHtml(destinatario.nome)}!</p><p style="margin:12px 0 0;"><strong>${escapeHtml(solicitanteNome)}</strong> pediu uma troca de escala com você.</p>`,
      cta: { texto: 'Ver pedido de troca', url: linkTroca(cdTrocaEscala) },
    }),
  })
}

// Evento: um gestor/admin trocou a escala da pessoa diretamente (sem pedido).
export async function notificarTrocaDiretaAplicada(destinatario: Destinatario, resumo: Array<{ tipo: string; dias: string[] }>, gestorNome: string): Promise<void> {
  if (!destinatario.email || resumo.length === 0) return
  const linhas = resumo.map(f => `<li>${nomeTipoEscala(f.tipo)} — ${formatarDias(f.dias)}</li>`).join('')
  await enviarEmail({
    to: destinatario.email,
    subject: 'Sua escala foi alterada',
    html: layout({
      titulo: 'Sua escala foi alterada',
      corpo: `<p style="margin:0 0 12px;">Olá, ${escapeHtml(destinatario.nome)}! <strong>${escapeHtml(gestorNome)}</strong> trocou sua escala diretamente. Confira sua nova escala:</p><ul style="margin:0; padding-left:18px;">${linhas}</ul>`,
      cta: { texto: 'Ver minha escala', url: linkEscalas() },
    }),
  })
}

// Evento: o colega respondeu (aceitou ou recusou) o pedido de troca.
export async function notificarTrocaRespondida(destinatario: Destinatario, aceita: boolean, outroNome: string, cdTrocaEscala: string | number): Promise<void> {
  if (!destinatario.email) return
  await enviarEmail({
    to: destinatario.email,
    subject: aceita ? 'Sua troca de escala foi aceita' : 'Sua troca de escala foi recusada',
    html: layout({
      titulo: aceita ? 'Troca de escala aceita' : 'Troca de escala recusada',
      corpo: `<p style="margin:0;">Olá, ${escapeHtml(destinatario.nome)}!</p><p style="margin:12px 0 0;"><strong>${escapeHtml(outroNome)}</strong> ${aceita ? 'aceitou' : 'recusou'} sua proposta de troca de escala.</p>`,
      cta: { texto: 'Ver troca', url: linkTroca(cdTrocaEscala) },
    }),
  })
}
