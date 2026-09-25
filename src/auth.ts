import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { query } from './lib/db'
import { autenticarNoGateway } from './lib/gatewayAuth'
import { consultarGau, ehGestorGeral, SISTEMA_GAU } from './lib/gauPerfis'

// Códigos que o login usa pra mostrar a mensagem certa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function provisionarUsuarioDoGau({ nome, email, matricula }: { nome: string; email: string | null; matricula: string | null }): Promise<any> {
  if (!email) return null

  await query(
    `INSERT INTO usuarios (nm_usuario, ds_email, tp_role, ds_matricula)
     VALUES ($1, $2, 'tecnico', $3)
     ON CONFLICT (ds_email) DO NOTHING`,
    [nome, email, matricula]
  )
  const { rows } = await query(
    `SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role, e.tp_equipe
     FROM usuarios u
     LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
     WHERE lower(u.ds_email) = lower($1) AND u.sn_ativo = true`,
    [email]
  )
  return rows[0] ?? null
}

class SemCadastro extends CredentialsSignin {
  code = 'sem_cadastro'
}
class GatewayIndisponivel extends CredentialsSignin {
  code = 'gateway_indisponivel'
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials) => {
        const login = String(credentials?.username || '').trim()
        const password = String(credentials?.password ?? '')
        if (!login || !password) return null

        // 1) Quem é? A senha de rede é conferida pelo gateway (mesmo login do Argos).
        let identidade
        try {
          identidade = await autenticarNoGateway(login, password)
        } catch {
          throw new GatewayIndisponivel()
        }
        if (!identidade) return null

        // 2) Qual o perfil dele aqui? Vem do cadastro local (perfil + equipe),
        // ligado pelo e-mail ou pela matrícula/login de rede. Se a pessoa
        // autenticou mas ainda não foi cadastrada, não entra.
        const normalizar = (valores: Array<string | null | undefined>) => [...new Set(
          valores.filter(Boolean).map(valor => String(valor).trim().toLowerCase())
        )]

        // O GAU (mesmo cadastro do Argos) conhece a pessoa por login de rede,
        // e-mail e matrícula — usa tudo isso pra achar o cadastro local, e
        // também pra saber os perfis dela lá (ver gestor geral abaixo).
        const gau = await consultarGau(normalizar([identidade.email, identidade.username, login]))
        const candidatos = normalizar([
          identidade.email, identidade.username, login,
          ...gau.emails, ...gau.logins, ...gau.matriculas,
        ])

        const { rows } = await query(
          `SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role, e.tp_equipe
           FROM usuarios u
           LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
           WHERE u.sn_ativo = true
             AND (lower(u.ds_email) = ANY($1::text[]) OR lower(u.ds_matricula) = ANY($1::text[]))
           ORDER BY (lower(u.ds_email) = ANY($1::text[])) DESC
           LIMIT 1`,
          [candidatos]
        )
        // Provisório: quem tem ADM + ARG_N3 no GAU enxerga o sistema como
        // gestor geral (admin, sem equipe fixa). Calculado a cada login, não
        // gravado no cadastro — tirar o perfil no GAU tira a visão no
        // próximo login.
        const gestorGeral = ehGestorGeral(gau.perfisSistema)
        console.info(`[login] ${login}: perfis no GAU =`, gau.perfis, `| no sistema ${SISTEMA_GAU} =`, gau.perfisSistema)

        let row = rows[0]
        if (!row && gestorGeral) {
          // O acesso vem do GAU, então quem tem o perfil não precisa de
          // cadastro prévio: cria o registro local (nome/e-mail/matrícula
          // vêm do GAU) no primeiro acesso. Guarda com o menor perfil — o
          // que vale como admin é o perfil do GAU, conferido a cada login.
          row = await provisionarUsuarioDoGau({
            nome: gau.nome || identidade.nome || login,
            email: gau.emails[0] || identidade.email,
            matricula: gau.matriculas[0] || null,
          })
        }
        if (!row) {
          console.warn('[login] autenticou no gateway mas sem cadastro local. Candidatos:', candidatos)
          throw new SemCadastro()
        }

        return {
          id: String(row.cd_usuario),
          name: row.nm_usuario,
          email: row.ds_email,
          role: gestorGeral ? 'admin' : row.tp_role,
          equipe: gestorGeral ? null : (row.tp_equipe || null),
        }
      },
    }),
  ],
})
