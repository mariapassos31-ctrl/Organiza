import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../../lib/db'
import { auth } from '../../../../auth'

const PERFIL_EXCLUSIVO_POR_EQUIPE = {
  projetos: ['analista'],
  dev: ['desenvolvedor'],
}

function validarPerfilEquipe(role, equipe) {
  if (role === 'admin' || role === 'gestor') return null
  const exclusivos = PERFIL_EXCLUSIVO_POR_EQUIPE[equipe]
  if (exclusivos && !exclusivos.includes(role)) {
    return `A equipe ${equipe} só aceita o perfil: ${exclusivos.join(', ')}`
  }
  if (role === 'desenvolvedor' && equipe !== 'dev') {
    return 'O perfil Desenvolvedor é exclusivo da equipe Dev'
  }
  return null
}

export async function PATCH(request, { params }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (minhaRole !== 'admin' && minhaRole !== 'gestor') {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const { uid } = await params
    const cdUsuario = Number(uid)
    const body = await request.json()
    const { nome, role, matricula, especialidade } = body
    let { equipe } = body

    const { rows: alvoRows } = await query(
      `SELECT u.tp_role, e.tp_equipe FROM usuarios u
       LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
       WHERE u.cd_usuario = $1`,
      [cdUsuario]
    )
    if (alvoRows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }
    const alvo = alvoRows[0]

    if (minhaRole === 'gestor') {
      if (alvo.tp_role === 'admin') {
        return NextResponse.json({ error: 'Você não pode editar um administrador' }, { status: 403 })
      }
      if (alvo.tp_equipe !== minhaEquipe) {
        return NextResponse.json({ error: 'Você só pode editar usuários da sua equipe' }, { status: 403 })
      }
      equipe = minhaEquipe
      if (role === 'admin') {
        return NextResponse.json({ error: 'Apenas admin pode promover para administrador' }, { status: 403 })
      }
    }

    if (minhaRole !== 'admin') {
      const erroPerfil = validarPerfilEquipe(role, equipe)
      if (erroPerfil) {
        return NextResponse.json({ error: erroPerfil }, { status: 400 })
      }
    }

    const equipeId = role === 'admin' ? null : await equipeIdFromSlug(equipe)

    const { rows } = await query(
      `UPDATE usuarios
       SET nm_usuario = $1, tp_role = $2, cd_equipe = $3, ds_matricula = $4
       WHERE cd_usuario = $5
       RETURNING cd_usuario`,
      [nome, role, equipeId, matricula || null, cdUsuario]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (role !== 'admin' && role !== 'gestor') {
      await query(
        `INSERT INTO tecnicos (cd_usuario, nm_tecnico, cd_equipe, ds_especialidade)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cd_usuario) DO UPDATE
           SET nm_tecnico = EXCLUDED.nm_tecnico,
               cd_equipe = EXCLUDED.cd_equipe,
               ds_especialidade = EXCLUDED.ds_especialidade`,
        [cdUsuario, nome, equipeId, especialidade || null]
      )
    } else {
      await query('DELETE FROM tecnicos WHERE cd_usuario = $1', [cdUsuario])
    }

    return NextResponse.json({ uid, nome, role, equipe: equipe || null })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(_request, { params }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe, id: meuId } = session.user
  if (minhaRole !== 'admin' && minhaRole !== 'gestor') {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const { uid } = await params
    const cdUsuario = Number(uid)

    if (String(meuId) === String(uid)) {
      return NextResponse.json({ error: 'Você não pode deletar sua própria conta' }, { status: 400 })
    }

    if (minhaRole === 'gestor') {
      const { rows: alvoRows } = await query(
        `SELECT u.tp_role, e.tp_equipe FROM usuarios u
         LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
         WHERE u.cd_usuario = $1`,
        [cdUsuario]
      )
      if (alvoRows.length === 0) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
      }
      if (alvoRows[0].tp_role === 'admin' || alvoRows[0].tp_equipe !== minhaEquipe) {
        return NextResponse.json({ error: 'Você só pode deletar usuários da sua equipe' }, { status: 403 })
      }
    }

    await query('DELETE FROM tecnicos WHERE cd_usuario = $1', [cdUsuario])
    await query('DELETE FROM usuarios WHERE cd_usuario = $1', [cdUsuario])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
