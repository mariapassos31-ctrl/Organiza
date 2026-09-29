import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { loginUser } from '../../services/auth'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/common/Button'
import toast from 'react-hot-toast'

export const Login = () => {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await loginUser(email, password)
      const { getUserData } = await import('../../services/auth')
      const userData = await getUserData(user.uid)

      setUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        ...userData,
      })

      toast.success('Login realizado com sucesso!')

      // Redirecionar baseado no role
      if (userData?.role === 'admin') {
        navigate('/admin/dashboard')
      } else if (userData?.role === 'technician') {
        navigate('/technician/dashboard')
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Escala TI</h1>
          <p className="text-gray-600">Sistema de Gerenciamento de Escalas</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            Entrar
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
          <p className="font-semibold mb-2">Credenciais de Teste:</p>
          <p>Admin: admin@escala.com / 123456</p>
          <p>Técnico: tech@escala.com / 123456</p>
        </div>
      </div>
    </div>
  )
}