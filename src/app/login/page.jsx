'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useAuthUser } from '../../hooks/useAuthUser'
import '../../styles/Login.css'

export default function Login() {
  const router = useRouter()
  const { user, loading: checkingAuth } = useAuthUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        <h1>Escala TI</h1>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
     {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="register-link">
            Não tem conta? <Link href="/register">Crie uma aqui</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
