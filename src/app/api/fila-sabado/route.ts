import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, getPool, equipeIdFromSlug } from '../../../lib/db'
import { auth } from '../../../auth'
import { ehPerfilGestao } from '../../../lib/equipesConfig'
import { buscarFilaSabado, salvarFilaSabado, transferirSabadosFuturos } from '../../../lib/filaSabado'

// Escala Sábado só existe pra equipe Suporte (numa sala exclusiva dela),
// então a fila é sempre dessa equipe — não precisa perguntar "qual equipe".
function podeGerenciar(role: string, equipe: string | null | undefined): boolean {
  return role === 'admin' || ((role === 'gestor' || role === 'lider') && equipe === 'suporte')
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe } = session.user
  if (!ehPerfilGestao(role) || !podeGerenciar(role, equipe)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  try {
    const equipeId = await equipeIdFromSlug('suporte')
    if (!equipeId) {
      return NextResponse.json({ error: 'Equipe Suporte não encontrada' }, { status: 404 })
    }
    const cdTecnicos = await buscarFilaSabado(equipeId)
    if (cdTecnicos.length === 0) {
      return NextResponse.json({ uids: [] })
    }
    const { rows } = await query(
      `SELECT cd_tecnico, cd_usuario FROM tecnicos WHERE cd_tecnico = ANY($1::int[])`,
      [cdTecnicos]
    )
    const uidPorTecnico = new Map(rows.map(r => [r.cd_tecnico, String(r.cd_usuario)]))
    const uids = cdTecnicos.map(cd => uidPorTecnico.get(cd)).filter((u): u is string => Boolean(u))
    return NextResponse.json({ uids })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role, equipe } = session.user
  if (!ehPerfilGestao(role) || !podeGerenciar(role, equipe)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }
  try {
    const body = await request.json()
    const uids: string[] = Array.isArray(body.uids) ? body.uids.filter(Boolean) : []
    // Substituições feitas nesta sessão de edição (ex: pessoa desligada) —
    // cada uma transfere pro substituto os sábados que a pessoa anterior já
    // tinha agendados de hoje em diante, além de só mudar a fila.
    const substituicoes: Array<{ deUid: string; paraUid: string }> = Array.isArray(body.substituicoes)
      ? body.substituicoes.filter((s: unknown): s is { deUid: string; paraUid: string } =>
          Boolean(s && typeof s === 'object' && 'deUid' in s && 'paraUid' in s))
      : []
    const equipeId = await equipeIdFromSlug('suporte')
    if (!equipeId) {
      return NextResponse.json({ error: 'Equipe Suporte não encontrada' }, { status: 404 })
    }

    // Resolve uid -> cd_tecnico preservando a ordem enviada (um simples
    // "= ANY($1)" não garante que as linhas voltam na mesma ordem do array)
    // e também os uids envolvidos nas substituições.
    const todosUids = [...new Set([...uids, ...substituicoes.flatMap(s => [s.deUid, s.paraUid])])]
    const usuarioIds = todosUids.map(Number).filter(n => !Number.isNaN(n))
    const { rows } = await query(
      `SELECT cd_tecnico, cd_usuario FROM tecnicos WHERE cd_usuario = ANY($1::int[]) AND cd_equipe = $2`,
      [usuarioIds, equipeId]
    )
    const tecnicoPorUsuario = new Map(rows.map(r => [String(r.cd_usuario), r.cd_tecnico]))
    const cdTecnicos = uids
      .map(uid => tecnicoPorUsuario.get(String(uid)))
      .filter((cd): cd is number => Boolean(cd))

    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      await salvarFilaSabado(client, equipeId, cdTecnicos)
      for (const { deUid, paraUid } of substituicoes) {
        const deCd = tecnicoPorUsuario.get(String(deUid))
        const paraCd = tecnicoPorUsuario.get(String(paraUid))
        if (deCd && paraCd) {
          await transferirSabadosFuturos(client, deCd, paraCd)
        }
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
