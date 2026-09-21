import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../../lib/db'
import { auth } from '../../../../auth'
import { perfisColaboradorPorEquipe } from '../../../../lib/equipesConfig'

function validarPerfilEquipe(role, equipe) {
  if (role === 'admin' || role === 'gestor') return null
  const permitidos = perfisColaboradorPorEquipe(equipe)
  if (!permitidos.includes(role)) {
    return `A equipe ${equipe} só aceita os perfis: ${permitidos.join(', ')}`
  }
  return null
}

// Uma baia comporta no máximo 2 ocupantes fixos (a "dupla"). cdUsuarioAtual
// é excluído da contagem (permite salvar sem "brigar" com o próprio registro).
async function validarBaiaDisponivel(equipeId, baia, cdUsuarioAtual) {
  if (baia === null || baia === undefined || baia === '') return null
  const numero = Number(baia)
  if (!Number.isInteger(numero) || numero < 1) {
    return 'Número da baia inválido'
  }
  const { rows } = await query(
    `SELECT cd_usuario FROM tecnicos
     WHERE cd_equipe = $1 AND nr_baia = $2 AND sn_ativo = true AND cd_usuario IS DISTINCT FROM $3`,
    [equipeId, numero, cdUsuarioAtual]
  )
  if (rows.length >= 2) {
    return `A baia ${numero} já tem 2 ocupantes`
  }
  return null
}

function validarPeriodoFerias(feriasInicio, feriasFim) {
  if (!feriasInicio && !feriasFim) return null
  if (!feriasInicio || !feriasFim) {
    return 'Informe início e fim das férias'
  }
  if (feriasFim < feriasInicio) {
    return 'O fim das férias não pode ser antes do início'
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
    const { nome, role, matricula, especialidade, horarioEntrada, baia, feriasInicio, feriasFim } = body
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

    if (role !== 'admin' && role !== 'gestor') {
      const erroBaia = await validarBaiaDisponivel(equipeId, baia, cdUsuario)
      if (erroBaia) {
        return NextResponse.json({ error: erroBaia }, { status: 400 })
      }
      const erroFerias = validarPeriodoFerias(feriasInicio, feriasFim)
      if (erroFerias) {
        return NextResponse.json({ error: erroFerias }, { status: 400 })
      }
    }

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
        `INSERT INTO tecnicos (cd_usuario, nm_tecnico, cd_equipe, ds_especialidade, hr_entrada, nr_baia, dt_ferias_inicio, dt_ferias_fim)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (cd_usuario) DO UPDATE
           SET nm_tecnico = EXCLUDED.nm_tecnico,
               cd_equipe = EXCLUDED.cd_equipe,
               ds_especialidade = EXCLUDED.ds_especialidade,
               hr_entrada = EXCLUDED.hr_entrada,
               nr_baia = EXCLUDED.nr_baia,
               dt_ferias_inicio = EXCLUDED.dt_ferias_inicio,
               dt_ferias_fim = EXCLUDED.dt_ferias_fim`,
        [cdUsuario, nome, equipeId, especialidade || null, horarioEntrada || null, baia || null, feriasInicio || null, feriasFim || null]
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
