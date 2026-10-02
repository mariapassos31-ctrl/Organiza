import 'server-only'
import { query, equipeIdFromSlug } from './db'

export interface UsuarioLocalRow {
  cd_usuario: number
  nm_usuario: string
  ds_email: string
  tp_role: string
  tp_equipe: string | null
}

// Cria o cadastro local (se ainda não existir, pelo e-mail) pra alguém que o
// GAU já autoriza com algum perfil ESCTI_*. `equipe` é opcional — quando dá
// pra resolver pelo TIME do RH (ver lib/mapaEquipeRh.ts) já entra certo;
// senão fica sem equipe, visível na tela de Usuários pra quem tem perfil de
// gestão completar pelo "✏️ Editar". Pra quem não é admin, também cria o
// vínculo em `tecnicos` — sem isso a pessoa não aparece pra ser escalada,
// mesmo com equipe definida. Usado no primeiro login (src/auth.ts) e na
// sincronização (lib/sincronizarUsuariosGau.ts).
export async function provisionarUsuarioDoGau({ nome, email, matricula, role, equipe }: { nome: string; email: string | null; matricula: string | null; role: string; equipe?: string | null }): Promise<UsuarioLocalRow | null> {
  if (!email) return null

  const equipeId = equipe ? await equipeIdFromSlug(equipe) : null

  const { rows: criado } = await query<{ cd_usuario: number }>(
    `INSERT INTO usuarios (nm_usuario, ds_email, tp_role, ds_matricula, cd_equipe)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ds_email) DO NOTHING
     RETURNING cd_usuario`,
    [nome, email, role, matricula, equipeId]
  )

  if (criado[0] && role !== 'admin') {
    await query(
      `INSERT INTO tecnicos (cd_usuario, nm_tecnico, ds_email, cd_equipe)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cd_usuario) DO NOTHING`,
      [criado[0].cd_usuario, nome, email, equipeId]
    )
  }

  const { rows } = await query<UsuarioLocalRow>(
    `SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role, e.tp_equipe
     FROM usuarios u
     LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
     WHERE lower(u.ds_email) = lower($1) AND u.sn_ativo = true`,
    [email]
  )
  return rows[0] ?? null
}
