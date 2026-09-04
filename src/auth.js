import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { authConfig } from './auth.config'
import { query } from './lib/db'

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
        if (!row || !row.ds_senha_hash) return null

        const senhaValida = await bcrypt.compare(password, row.ds_senha_hash)
        if (!senhaValida) return null

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
