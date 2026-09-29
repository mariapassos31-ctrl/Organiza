'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, getSession } from 'next-auth/react'
import Image from 'next/image'
import { CalendarClock, User, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuthUser } from '../../hooks/useAuthUser'
import { rotaInicialPorPerfil } from '../../lib/equipesConfig'

const MENSAGENS_ERRO: Record<string, string> = {
  sem_cadastro: 'Você entrou com a senha de rede, mas ainda não tem cadastro no Escala TI. Procure o seu gestor.',
  gateway_indisponivel: 'Não foi possível validar o acesso agora. Tente novamente em instantes.',
}

// Só volta pra um link interno do dashboard (ex.: quem foi mandado pro login
// ao abrir /dashboard/trocas); qualquer outra coisa cai na tela do perfil.
function destinoDepoisDoLogin(callbackUrl: string | null, role: string | null | undefined): string {
  try {
    const url = new URL(callbackUrl ?? '', window.location.origin)
    if (url.origin === window.location.origin && url.pathname.startsWith('/dashboard/')) {
      return url.pathname + url.search
    }
  } catch {
    // callbackUrl ausente/inválido: segue pro destino padrão do perfil
  }
  return rotaInicialPorPerfil(role)
}

const CAMPO =
  'block w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 font-semibold text-black outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/5 disabled:opacity-60'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: checkingAuth } = useAuthUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!checkingAuth && user) {
      router.replace(destinoDepoisDoLogin(searchParams.get('callbackUrl'), user.role))
    }
  }, [checkingAuth, user, router, searchParams])

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', { username, password, redirect: false })

      if (result?.error) {
        setError(MENSAGENS_ERRO[result.code ?? ''] || 'Usuário ou senha inválidos.')
        return
      }

      // O signIn não devolve o usuário; lê a sessão recém-criada pra saber o
      // perfil e mandar a pessoa direto pra tela certa dela.
      const session = await getSession()
      window.location.href = destinoDepoisDoLogin(searchParams.get('callbackUrl'), session?.user?.role)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth || user) {
    return (
      <div className="flex h-screen items-center justify-center text-xs font-black uppercase tracking-widest text-slate-400">
        Carregando...
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] font-sans md:flex-row">
      {/* Banner lateral */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-brand to-brand-dark p-8 text-white md:w-1/2">
        <div className="absolute right-0 top-0 -mr-32 -mt-32 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

        <div className="z-10 max-w-md text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-xl">
            <CalendarClock size={40} />
          </div>
          <Image src="/images/logo-fjs.png" width={72} height={72} alt="FJS" className="mx-auto mb-6 opacity-90" priority />
          <h1 className="mb-4 text-3xl font-black uppercase tracking-tighter">Escala TI</h1>
          <div className="mx-auto mb-4 h-1 w-16 rounded-full bg-white" />
          <p className="text-lg font-medium opacity-80">Fundação José Silveira</p>
        </div>
      </div>

      {/* Área de login */}
      <div className="flex items-center justify-center p-8 md:w-1/2">
        <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-10 shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">Identificação</h2>
            <p className="mt-2 font-medium text-gray-500">Entre com suas credenciais de rede</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-r-xl border-l-4 border-red-500 bg-red-50 p-4 text-sm font-bold text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="username" className="ml-1 block text-xs font-black uppercase tracking-widest text-gray-400">
                Usuário / Matrícula
              </label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 transition-colors group-focus-within:text-brand">
                  <User size={18} />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  disabled={loading}
                  placeholder="Seu login (ex: usuario1234)"
                  className={CAMPO}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="ml-1 block text-xs font-black uppercase tracking-widest text-gray-400">
                Senha de rede
              </label>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 transition-colors group-focus-within:text-brand">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  placeholder="••••••••"
                  className={`${CAMPO} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 transition-colors hover:text-brand"
                >
                  {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className={`flex w-full transform items-center justify-center gap-2 rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 ${
                  loading ? 'cursor-not-allowed bg-gray-400' : 'bg-brand shadow-brand/20 hover:bg-brand-dark'
                }`}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Autenticando' : 'Acessar Sistema'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              TI & Governança de Dados • FJS © 2026
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
