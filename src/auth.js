import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { query } from './lib/db'

// Hash "de mentira", calculado uma vez, pra comparar contra ele quando o
// e-mail não existe — sem isso, um e-mail inexistente responde na hora
// (nunca chama bcrypt.compare) enquanto um e-mail real demora o tempo do
// bcrypt, e essa diferença de tempo dá pra descobrir quais e-mails têm
// conta no sistema só medindo a resposta do login.
const HASH_FANTASMA = bcrypt.hashSync('senha-que-nunca-existe', 10)

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email
        const password = credentials?.password
        if (!email || !password) return null

        const { rows } = await query(
          `SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role, u.ds_senha_hash, e.tp_equipe
           FROM usuarios u
           LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
           WHERE u.ds_email = $1 AND u.sn_ativo = true`,
          [email]
        )
        const row = rows[0]

        const senhaValida = await bcrypt.compare(password, row?.ds_senha_hash || HASH_FANTASMA)
        if (!row || !row.ds_senha_hash || !senhaValida) return null

        return {
          id: String(row.cd_usuario),
          name: row.nm_usuario,
          email: row.ds_email,
          role: row.tp_role,
          equipe: row.tp_equipe || null,
        }
      },
    }),
  ],
})
