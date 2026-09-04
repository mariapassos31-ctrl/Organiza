// Configuração "edge-safe": sem provider nem acesso a banco, usada pelo
// middleware (que roda no Edge runtime, onde o driver `pg` não funciona).
// O provider de Credentials + acesso ao Postgres fica só em src/auth.js
// (Node runtime), usado pela rota de API e pelos Server Components.
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = request.nextUrl.pathname.startsWith('/dashboard')

      if (isOnDashboard) {
        return isLoggedIn
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.role = user.role
        token.equipe = user.equipe
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid
        session.user.role = token.role
        session.user.equipe = token.equipe
      }
      return session
    },
  },
}
