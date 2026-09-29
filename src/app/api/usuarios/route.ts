import { mensagemDeErro, codigoPg } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../lib/db'
import { auth } from '../../../auth'
import { perfisColaboradorPorEquipe, ehPerfilGestao } from '../../../lib/equipesConfig'
import { ehJovemAprendiz } from '../../../lib/escalasConstants'

function validarPerfilEquipe(role: string, equipe: string | null | undefined): string | null {
  if (ehPerfilGestao(role)) return null
  const permitidos = perfisColaboradorPorEquipe(equipe)
  if (!permitidos.includes(role)) {
    return `A equipe ${equipe} só aceita os perfis: ${permitidos.join(', ')}`
  }
  return null
}

// Dados sensíveis (e-mail, matrícula, especialidade, horário, férias) só
// aparecem pra quem tem motivo legítimo de ver: admin, o próprio usuário, ou
// o gestor da equipe dele. Qualquer outro colaborador autenticado ainda
// recebe nome/equipe/perfil/baia (necessário pra resolver nomes nas escalas
// de todo mundo e desenhar o mapa da sala), mas não o resto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApiShape(row: any, viewer: { id: string; role: string; equipe?: string | null }) {
  const podeVerDetalhes = viewer.role === 'admin' ||
    ((viewer.role === 'gestor' || viewer.role === 'lider') && row.tp_equipe && row.tp_equipe === viewer.equipe) ||
    String(row.cd_usuario) === String(viewer.id)

  return {
    uid: String(row.cd_usuario),
    nome: row.nm_usuario,
    email: podeVerDetalhes ? row.ds_email : '',
    role: row.tp_role,
    equipe: row.tp_equipe || null,
    matricula: podeVerDetalhes ? (row.ds_matricula || '') : '',
    especialidade: podeVerDetalhes ? (row.ds_especialidade || '') : '',
    horarioEntrada: podeVerDetalhes && row.hr_entrada ? String(row.hr_entrada).slice(0, 5) : '',
    baia: row.nr_baia != null ? String(row.nr_baia) : '',
    baiaFixa: Boolean(row.sn_baia_fixa),
    elegivelHomeOffice: row.sn_elegivel_home_office !== false,
    // Sinalizadores específicos — visíveis pra todo mundo porque o mapa da
    // sala/calendário compartilhado depende deles pra qualquer colega que
    // olhar, não só admin/gestor. "Supervisor" é quem está na baia especial
    // 0 (não depende de especialidade — é só colocar a pessoa na baia).
    ehSupervisor: row.nr_baia === 0,
    ehAprendiz: ehJovemAprendiz(row.tp_role),
    diaCurso: row.nr_dia_curso ?? null,
    feriasInicio: podeVerDetalhes ? (row.dt_ferias_inicio || '') : '',
    feriasFim: podeVerDetalhes ? (row.dt_ferias_fim || '') : '',
    ativo: row.sn_ativo,
    criadoEm: row.dt_criacao,
  }
}

const SELECT_USUARIOS = `
  SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role, u.ds_matricula,
         u.sn_ativo, u.dt_criacao, e.tp_equipe, t.ds_especialidade, t.hr_entrada, t.nr_baia, t.sn_baia_fixa,
         t.sn_elegivel_home_office, t.nr_dia_curso,
         to_char(t.dt_ferias_inicio, 'YYYY-MM-DD') AS dt_ferias_inicio,
         to_char(t.dt_ferias_fim, 'YYYY-MM-DD') AS dt_ferias_fim
  FROM usuarios u
  LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
  LEFT JOIN tecnicos t ON t.cd_usuario = u.cd_usuario
`

function validarPeriodoFerias(feriasInicio: string | null | undefined, feriasFim: string | null | undefined): string | null {
  if (!feriasInicio && !feriasFim) return null
  if (!feriasInicio || !feriasFim) {
    return 'Informe início e fim das férias'
  }
  if (feriasFim < feriasInicio) {
    return 'O fim das férias não pode ser antes do início'
  }
  return null
}

function validarDiaCurso(diaCurso: unknown): string | null {
  if (diaCurso === null || diaCurso === undefined || diaCurso === '') return null
  const numero = Number(diaCurso)
  if (!Number.isInteger(numero) || numero < 0 || numero > 6) {
    return 'Dia do curso inválido'
  }
  return null
}

// Uma baia comporta no máximo 2 ocupantes fixos (a "dupla") — exceto a baia
// 0, que é a vaga especial do Supervisor e só comporta 1 pessoa por vez.
// cdUsuarioAtual é excluído da contagem (permite salvar sem "brigar" com o
// próprio registro).
async function validarBaiaDisponivel(equipeId: number | null, baia: unknown, cdUsuarioAtual: number | null): Promise<string | null> {
  if (baia === null || baia === undefined || baia === '') return null
  const numero = Number(baia)
  if (!Number.isInteger(numero) || numero < 0) {
    return 'Número da baia inválido'
  }
  const { rows } = await query(
    `SELECT cd_usuario FROM tecnicos
     WHERE cd_equipe = $1 AND nr_baia = $2 AND sn_ativo = true AND cd_usuario IS DISTINCT FROM $3`,
    [equipeId, numero, cdUsuarioAtual]
  )
  const limite = numero === 0 ? 1 : 2
  if (rows.length >= limite) {
    return numero === 0 ? 'Já existe um Supervisor cadastrado' : `A baia ${numero} já tem 2 ocupantes`
  }
  return null
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let viewerEquipe = session.user.equipe
  if ((session.user.role === 'gestor' || session.user.role === 'lider') && !viewerEquipe) {
    const { rows } = await query(
      `SELECT e.tp_equipe FROM usuarios u
       JOIN equipes e ON e.cd_equipe = u.cd_equipe
       WHERE u.cd_usuario = $1`,
      [session.user.id]
    )
    viewerEquipe = rows[0]?.tp_equipe || null
  }
  const viewer = { ...session.user, equipe: viewerEquipe }

  const { rows } = await query(`${SELECT_USUARIOS} ORDER BY u.nm_usuario`)
  return NextResponse.json(rows.map(row => toApiShape(row, viewer)))
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (!ehPerfilGestao(minhaRole)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { nome, email, role, matricula, especialidade, horarioEntrada, baia, baiaFixa, elegivelHomeOffice, diaCurso, feriasInicio, feriasFim } = body
    let { equipe } = body

    if (!nome || !email || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }
    if (role === 'admin' && minhaRole !== 'admin') {
      return NextResponse.json({ error: 'Apenas admin pode criar contas de administrador' }, { status: 403 })
    }

    // Gestor/Líder só criam gente na própria equipe, e não escolhem uma equipe arbitrária
    if (minhaRole === 'gestor' || minhaRole === 'lider') {
      equipe = minhaEquipe
    }

    if (minhaRole !== 'admin') {
      const erroPerfil = validarPerfilEquipe(role, equipe)
      if (erroPerfil) {
        return NextResponse.json({ error: erroPerfil }, { status: 400 })
      }
    }

    const equipeId = role === 'admin' ? null : await equipeIdFromSlug(equipe)

    if (role !== 'admin') {
      const erroBaia = await validarBaiaDisponivel(equipeId, baia, null)
      if (erroBaia) {
        return NextResponse.json({ error: erroBaia }, { status: 400 })
      }
      const erroFerias = validarPeriodoFerias(feriasInicio, feriasFim)
      if (erroFerias) {
        return NextResponse.json({ error: erroFerias }, { status: 400 })
      }
      const erroDiaCurso = validarDiaCurso(diaCurso)
      if (erroDiaCurso) {
        return NextResponse.json({ error: erroDiaCurso }, { status: 400 })
      }
    }

    // Sem senha local: o login é pela senha de rede (gateway), ligado a este
    // cadastro pelo e-mail ou pela matrícula.
    const { rows } = await query(
      `INSERT INTO usuarios (nm_usuario, ds_email, tp_role, cd_equipe, ds_matricula)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING cd_usuario`,
      [nome, email, role, equipeId, matricula || null]
    )
    const cdUsuario = rows[0].cd_usuario

    if (role !== 'admin') {
      await query(
        `INSERT INTO tecnicos (cd_usuario, nm_tecnico, ds_email, cd_equipe, ds_especialidade, hr_entrada, nr_baia, sn_baia_fixa, sn_elegivel_home_office, nr_dia_curso, dt_ferias_inicio, dt_ferias_fim)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (cd_usuario) DO UPDATE
           SET nm_tecnico = EXCLUDED.nm_tecnico,
               ds_email = EXCLUDED.ds_email,
               cd_equipe = EXCLUDED.cd_equipe,
               ds_especialidade = EXCLUDED.ds_especialidade,
               hr_entrada = EXCLUDED.hr_entrada,
               nr_baia = EXCLUDED.nr_baia,
               sn_baia_fixa = EXCLUDED.sn_baia_fixa,
               sn_elegivel_home_office = EXCLUDED.sn_elegivel_home_office,
               nr_dia_curso = EXCLUDED.nr_dia_curso,
               dt_ferias_inicio = EXCLUDED.dt_ferias_inicio,
               dt_ferias_fim = EXCLUDED.dt_ferias_fim`,
        [cdUsuario, nome, email, equipeId, especialidade || null, horarioEntrada || null, baia || null, Boolean(baiaFixa) || Number(baia) === 0, elegivelHomeOffice !== false, diaCurso === '' || diaCurso === undefined ? null : diaCurso, feriasInicio || null, feriasFim || null]
      )
    }

    return NextResponse.json({ uid: String(cdUsuario), nome, email, role, equipe: equipe || null }, { status: 201 })
  } catch (error) {
    if (codigoPg(error) === '23505') {
      return NextResponse.json({ error: 'email-already-in-use' }, { status: 409 })
    }
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
