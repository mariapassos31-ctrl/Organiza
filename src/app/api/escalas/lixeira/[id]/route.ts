import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'

// Mesma regra de permissão do apagar normal: admin vê tudo, gestor/líder só
// da própria equipe, e líder não mexe na própria escala (só pede troca).
async function checarPermissao(
  id: string,
  role: string,
  sessionEquipe: string | null | undefined,
  meuId: string
): Promise<{ error: string; status: number } | null> {
  const { rows } = await query(
    `SELECT eq.tp_equipe, u.cd_usuario AS tecnico_usuario_id
     FROM escalas es
     JOIN equipes eq ON eq.cd_equipe = es.cd_equipe
     LEFT JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     LEFT JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     LEFT JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE es.cd_escala = $1 AND es.tp_status = 'cancelada'`,
    [id]
  )
  if (rows.length === 0) {
    return { error: 'Escala não encontrada na lixeira', status: 404 }
  }
  if (role === 'admin') return null

  let userEquipe = sessionEquipe
  if (!userEquipe) {
    const { rows: ur } = await query(
      `SELECT e.tp_equipe FROM usuarios u JOIN equipes e ON e.cd_equipe = u.cd_equipe WHERE u.cd_usuario = $1`,
      [meuId]
    )
    userEquipe = ur[0]?.tp_equipe || null
  }
  if (rows[0].tp_equipe !== userEquipe) {
    return { error: 'Você só pode gerenciar a lixeira da sua equipe', status: 403 }
  }
  if (role === 'lider' && rows.some(r => String(r.tecnico_usuario_id) === String(meuId))) {
    return { error: 'Você não pode restaurar ou apagar a própria escala', status: 403 }
  }
  return null
}

// Restaura: tira da lixeira e volta a valer normalmente.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe, id: meuId } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const { id } = await params
  const erro = await checarPermissao(id, role, sessionEquipe, meuId)
  if (erro) {
    return NextResponse.json({ error: erro.error }, { status: erro.status })
  }
  try {
    await query(
      `UPDATE escalas SET tp_status = 'ativa', dt_atualizacao = now() WHERE cd_escala = $1`,
      [id]
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}

// Apaga definitivamente antes do prazo de 7 dias (o expurgo automático já
// faz isso sozinho quando o prazo vence, mas o gestor/admin pode adiantar).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe: sessionEquipe, id: meuId } = session.user
  if (!ehPerfilGestao(role)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  const { id } = await params
  const erro = await checarPermissao(id, role, sessionEquipe, meuId)
  if (erro) {
    return NextResponse.json({ error: erro.error }, { status: erro.status })
  }
  try {
    await query('DELETE FROM escalas WHERE cd_escala = $1', [id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
