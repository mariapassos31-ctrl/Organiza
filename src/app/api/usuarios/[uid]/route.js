import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../../lib/db'

export async function PATCH(request, { params }) {
  try {
    const { uid } = await params
    const cdUsuario = Number(uid)
    const body = await request.json()
    const { nome, role, equipe } = body

    const equipeId = role === 'admin' ? null : await equipeIdFromSlug(equipe)

    const { rows } = await query(
      `UPDATE usuarios
       SET nm_usuario = $1, tp_role = $2, cd_equipe = $3
       WHERE cd_usuario = $4
       RETURNING cd_usuario`,
      [nome, role, equipeId, cdUsuario]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (role === 'tecnico' || role === 'analista') {
      await query(
        `INSERT INTO tecnicos (cd_usuario, nm_tecnico, cd_equipe)
         VALUES ($1, $2, $3)
         ON CONFLICT (cd_usuario) DO UPDATE
           SET nm_tecnico = EXCLUDED.nm_tecnico,
               cd_equipe = EXCLUDED.cd_equipe`,
        [cdUsuario, nome, equipeId]
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
  try {
    const { uid } = await params
    const cdUsuario = Number(uid)

    await query('DELETE FROM tecnicos WHERE cd_usuario = $1', [cdUsuario])
    await query('DELETE FROM usuarios WHERE cd_usuario = $1', [cdUsuario])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
