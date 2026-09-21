'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { CalendarClock, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuthUser } from '../../hooks/useAuthUser'
import '../../styles/Login.css'

export default function Login() {
  const router = useRouter()
  const { user, loading: checkingAuth } = useAuthUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!checkingAuth && user) {
      router.replace('/dashboard')
    }
  }, [checkingAuth, user, router])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', { email, password, redirect: false })

      if (result?.error) {
        setError('E-mail ou senha inválidos')
        return
      }

      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth || user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Carregando...
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-brand">
          <div className="login-brand-icon">
            <CalendarClock size={28} />
          </div>
          <h1>Escala TI</h1>
          <p className="login-subtitle">Gerenciamento de escalas de técnicos de TI</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <span className="login-field-icon"><Mail size={18} /></span>
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <span className="login-field-icon"><Lock size={18} /></span>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="login-field-toggle"
              onClick={() => setMostrarSenha(v => !v)}
              tabIndex={-1}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="error">
              <AlertCircle size={16} />
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="login-spinner" /> : null}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
