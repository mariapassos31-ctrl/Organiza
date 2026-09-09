import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query, equipeIdFromSlug } from '../../../lib/db'
import { auth } from '../../../auth'

// Times com perfil de colaborador fixo. Fora daqui (suporte/infraestrutura/
// sistemas), qualquer perfil que não seja admin/gestor é aceito.
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

function toApiShape(row) {
  return {
    uid: String(row.cd_usuario),
    nome: row.nm_usuario,
    email: row.ds_email,
    role: row.tp_role,
    equipe: row.tp_equipe || null,
    matricula: row.ds_matricula || '',
    especialidade: row.ds_especialidade || '',
    ativo: row.sn_ativo,
    criadoEm: row.dt_criacao,
  }
}

const SELECT_USUARIOS = `
  SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role, u.ds_matricula,
         u.sn_ativo, u.dt_criacao, e.tp_equipe, t.ds_especialidade
  FROM usuarios u
  LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
  LEFT JOIN tecnicos t ON t.cd_usuario = u.cd_usuario
`

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { rows } = await query(`${SELECT_USUARIOS} ORDER BY u.nm_usuario`)
  return NextResponse.json(rows.map(toApiShape))
}

export async function POST(request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (minhaRole !== 'admin' && minhaRole !== 'gestor') {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { nome, email, senha, role, matricula, especialidade } = body
    let { equipe } = body

    if (!nome || !email || !senha || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (senha.length < 6) {
      return NextResponse.json({ error: 'weak-password' }, { status: 400 })
    }
    if (role === 'admin' && minhaRole !== 'admin') {
      return NextResponse.json({ error: 'Apenas admin pode criar contas de administrador' }, { status: 403 })
    }

    // Gestor só cria gente na própria equipe, e não escolhe uma equipe arbitrária
    if (minhaRole === 'gestor') {
      equipe = minhaEquipe
    }

    if (minhaRole !== 'admin') {
      const erroPerfil = validarPerfilEquipe(role, equipe)
      if (erroPerfil) {
        return NextResponse.json({ error: erroPerfil }, { status: 400 })
      }
    }

    const equipeId = role === 'admin' ? null : await equipeIdFromSlug(equipe)
    const senhaHash = await bcrypt.hash(senha, 10)

    const { rows } = await query(
      `INSERT INTO usuarios (nm_usuario, ds_email, tp_role, cd_equipe, ds_senha_hash, ds_matricula)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING cd_usuario`,
      [nome, email, role, equipeId, senhaHash, matricula || null]
    )
    const cdUsuario = rows[0].cd_usuario

    if (role !== 'admin' && role !== 'gestor') {
      await query(
        `INSERT INTO tecnicos (cd_usuario, nm_tecnico, ds_email, cd_equipe, ds_especialidade)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cd_usuario) DO UPDATE
           SET nm_tecnico = EXCLUDED.nm_tecnico,
               ds_email = EXCLUDED.ds_email,
               cd_equipe = EXCLUDED.cd_equipe,
               ds_especialidade = EXCLUDED.ds_especialidade`,
        [cdUsuario, nome, email, equipeId, especialidade || null]
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
