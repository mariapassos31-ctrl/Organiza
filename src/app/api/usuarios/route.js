import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query, equipeIdFromSlug } from '../../../lib/db'

function toApiShape(row) {
  return {
    uid: String(row.cd_usuario),
    nome: row.nm_usuario,
    email: row.ds_email,
    role: row.tp_role,
    equipe: row.tp_equipe || null,
    ativo: row.sn_ativo,
    criadoEm: row.dt_criacao,
  }
}

const SELECT_USUARIOS = `
  SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role,
         u.sn_ativo, u.dt_criacao, e.tp_equipe
  FROM usuarios u
  LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
`

export async function GET() {
  const { rows } = await query(`${SELECT_USUARIOS} ORDER BY u.nm_usuario`)
  return NextResponse.json(rows.map(toApiShape))
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { nome, email, senha, role, equipe } = body

    if (!nome || !email || !senha || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'weak-password' }, { status: 400 })
    }

    const equipeId = role === 'admin' ? null : await equipeIdFromSlug(equipe)
    const senhaHash = await bcrypt.hash(senha, 10)

    const { rows } = await query(
      `INSERT INTO usuarios (nm_usuario, ds_email, tp_role, cd_equipe, ds_senha_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING cd_usuario`,
      [nome, email, role, equipeId, senhaHash]
    )
    const cdUsuario = rows[0].cd_usuario

    if (role === 'tecnico' || role === 'analista') {
      await query(
        `INSERT INTO tecnicos (cd_usuario, nm_tecnico, ds_email, cd_equipe)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cd_usuario) DO UPDATE
           SET nm_tecnico = EXCLUDED.nm_tecnico,
               ds_email = EXCLUDED.ds_email,
               cd_equipe = EXCLUDED.cd_equipe`,
        [cdUsuario, nome, email, equipeId]
      )
    }

    return NextResponse.json({ uid: String(cdUsuario), nome, email, role, equipe: equipe || null }, { status: 201 })
  } catch (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'email-already-in-use' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
