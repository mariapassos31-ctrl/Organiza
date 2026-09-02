import { useState } from 'react'
import { registerUser } from '../services/auth'
import { useNavigate } from 'react-router-dom'
import '../styles/Register.css'

export default function Register() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const validarSenha = (senha) => {
    if (senha.length < 6) {
      return 'A senha deve ter no mínimo 6 caracteres'
    }
    return null
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')

    // Validações
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório')
      return
    }

    if (!formData.email.trim()) {
      setError('E-mail é obrigatório')
      return
    }

    const erroSenha = validarSenha(formData.senha)
    if (erroSenha) {
      setError(erroSenha)
      return
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas não conferem')
      return
    }

    setLoading(true)

    try {
      await registerUser(formData.email, formData.senha, formData.nome)
      alert('Usuário criado com sucesso! Faça login agora.')
      navigate('/login')
    } catch (err) {
      if (err.message.includes('email-already-in-use')) {
        setError('Este e-mail já está cadastrado')
      } else if (err.message.includes('invalid-email')) {
        setError('E-mail inválido')
      } else if (err.message.includes('weak-password')) {
        setError('Senha muito fraca')
      } else {
        setError(err.message || 'Erro ao criar usuário')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-container">
      <div className="register-box">
        <h1>Escala TI</h1>
        <h2>Criar Conta</h2>
        
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>Nome Completo</label>
            <input
              type="text"
              placeholder="João Silva"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="joao@escala.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={formData.senha}
              onChange={(e) => setFormData({...formData, senha: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Confirmar Senha</label>
            <input
              type="password"
              placeholder="Confirme sua senha"
              value={formData.confirmarSenha}
              onChange={(e) => setFormData({...formData, confirmarSenha: e.target.value})}
              required
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <p className="login-link">
          Já tem conta? <a href="/login">Faça login aqui</a>
        </p>
      </div>
    </div>
  )
}