import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role?: string
    equipe?: string | null
  }

  interface Session {
    user: {
      id: string
      role: string
      equipe: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string
    role?: string
    equipe?: string | null
  }
}
