import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { query } from './lib/db'
import { autenticarNoGateway } from './lib/gatewayAuth'
import { consultarGau, papelDoGau, SISTEMA_GAU } from './lib/gauPerfis'
import { provisionarUsuarioDoGau } from './lib/provisionarUsuario'

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
        const t0 = Date.now()
        try {
          identidade = await autenticarNoGateway(login, password)
        } catch {
          throw new GatewayIndisponivel()
        } finally {
          console.info(`[login] gateway respondeu em ${Date.now() - t0}ms`)
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
        const t1 = Date.now()
        const gau = await consultarGau(normalizar([identidade.email, identidade.username, login]))
        console.info(`[login] GAU respondeu em ${Date.now() - t1}ms`)
        const candidatos = normalizar([
          identidade.email, identidade.username, login,
          ...gau.emails, ...gau.logins, ...gau.matriculas,
        ])

        const t2 = Date.now()
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
        console.info(`[login] banco local respondeu em ${Date.now() - t2}ms`)
        // Quem papel do GAU (sistema ESCTI) manda mais que o cadastro local —
        // ver lib/gauPerfis.ts. Calculado a cada login, não gravado no
        // cadastro: mudar o perfil no GAU muda o acesso no próximo login.
        const papel = papelDoGau(gau.perfisSistema)
        console.info(`[login] ${login}: perfis no GAU =`, gau.perfis, `| papel no sistema ${SISTEMA_GAU} =`, papel)

        let row = rows[0]
        if (!row && papel) {
          // Quem o GAU já autoriza (qualquer um dos 4 perfis ESCTI_*) não
          // precisa esperar a sincronização agendada — provisiona na hora.
          // Admin entra pronto (não precisa de equipe); os demais entram
          // sem equipe definida até alguém da gestão completar o cadastro
          // em "✏️ Editar" — a sincronização automática (ver
          // lib/sincronizarUsuariosGau.ts) cobre quem nunca chegou a logar.
          row = await provisionarUsuarioDoGau({
            nome: gau.nome || identidade.nome || login,
            email: gau.emails[0] || identidade.email,
            matricula: gau.matriculas[0] || null,
            role: papel,
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
          role: papel ?? row.tp_role,
          // Admin não é restrito pela própria equipe em lugar nenhum do
          // sistema (sempre escolhe explicitamente, vê tudo) — mas isso não
          // significa que ele não TENHA uma equipe de verdade; mostra ela
          // quando o cadastro tiver, só informativo.
          equipe: row.tp_equipe || null,
        }
      },
    }),
  ],
})
