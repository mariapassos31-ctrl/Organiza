import { httpsCallable } from 'firebase/functions'
import { functions } from '../services/firebase'
import { useState, useEffect } from 'react'
import { registerUser } from '../services/auth'
import { auth } from '../services/firebase'
import '../styles/Usuarios.css'

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showFormCriar, setShowFormCriar] = useState(false)
  const [showFormEditar, setShowFormEditar] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [filtroEquipe, setFiltroEquipe] = useState('todos')
  const [formCriar, setFormCriar] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    equipe: 'suporte',
    role: 'tecnico'
  })
  const [formEditar, setFormEditar] = useState({
    nome: '',
    equipe: 'suporte',
    role: 'tecnico'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState(false)

  // ✅ APENAS EQUIPES REAIS (sem Analista)
  const EQUIPES = [
    { id: 'suporte', label: '🎧 Suporte', cor: '#3498db' },
    { id: 'infraestrutura', label: '🔧 Infraestrutura', cor: '#e74c3c' },
    { id: 'sistemas', label: '💻 Sistemas', cor: '#27ae60' }
  ]

  // ✅ PERFIS (Analista agora é perfil, não equipe)
  const PERFIS = [
    { id: 'tecnico', label: '👤 Técnico' },
    { id: 'analista', label: '📊 Analista' },
    { id: 'gestor', label: '👨‍💼 Gestor' },
     { id: 'admin', label: '🔐 Admin' }
  ]

  useEffect(() => {
    const currentUser = auth.currentUser
    setUser(currentUser)
    if (currentUser) {
      const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]')
      const usuarioEncontrado = usuarios.find(u => u.uid === currentUser.uid)
      if (usuarioEncontrado) {
        setUserData(usuarioEncontrado)
        setFormCriar(prev => ({
          ...prev,
          equipe: usuarioEncontrado.equipe || 'suporte'
        }))
      }
    }
    carregarUsuarios()
  }, [])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const carregarUsuarios = () => {
    try {
      const dados = localStorage.getItem('usuarios')
      if (dados) {
        const usuariosParsed = JSON.parse(dados)
        setUsuarios(usuariosParsed)
      }
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      setLoading(false)
    }
  }

  const podecriarUsuario = () => {
    if (!userData) return false
    if (userData.role === 'admin') return true
    if (userData.role === 'gestor') return true
    return false
  }

  const equipesDisponiveis = () => {
    if (!userData) return EQUIPES
    if (userData.role === 'admin') return EQUIPES
    if (userData.role === 'gestor') return EQUIPES.filter(e => e.id === userData.equipe)
    return []
  }

  // ✅ APENAS ADMIN PODE PROMOVER PARA GESTOR
  const perfisDisponiveis = () => {
  if (userData?.role === 'admin') {
    return PERFIS // Admin vê todos os perfis
  }
  // Gestor vê apenas Técnico e Analista (não pode criar Admin)
  return PERFIS.filter(p => p.id !== 'admin')
}

  const abrirEditar = (usuario) => {
    setUsuarioEditando(usuario)
    setFormEditar({
      nome: usuario.nome,
      email: usuario.email,
      equipe: usuario.equipe,
      role: usuario.role
    })
    setShowFormEditar(true)
  }

 const handleCriarUsuario = async (e) => {
  e.preventDefault()
  setError('')
  setSuccess('')
  setCriando(true)

  if (!formCriar.nome.trim()) {
    setError('Nome é obrigatório')
    setCriando(false)
    return
  }
  if (!formCriar.email.trim()) {
    setError('E-mail é obrigatório')
    setCriando(false)
    return
  }
  if (formCriar.senha.length < 6) {
    setError('Senha deve ter no mínimo 6 caracteres')
    setCriando(false)
    return
  }
  if (formCriar.senha !== formCriar.confirmarSenha) {
    setError('As senhas não conferem')
    setCriando(false)
    return
  }

  // ✅ VALIDAÇÃO: Apenas Admin pode criar Admin
  if (formCriar.role === 'admin' && userData?.role !== 'admin') {
    setError('❌ Apenas Admin pode criar contas de Administrador')
    setCriando(false)
    return
  }

  try {
    const userCredential = await registerUser(formCriar.email, formCriar.senha, formCriar.nome)
    const usuariosAtualizados = JSON.parse(localStorage.getItem('usuarios') || '[]')
    const usuarioCriado = usuariosAtualizados.find(u => u.uid === userCredential.uid)
    
    if (usuarioCriado) {
      usuarioCriado.role = formCriar.role
      
      // ✅ Admin NÃO precisa de equipe
      if (formCriar.role === 'admin') {
        usuarioCriado.equipe = null
      } else {
        usuarioCriado.equipe = formCriar.equipe
      }

      localStorage.setItem('usuarios', JSON.stringify(usuariosAtualizados))
      setUsuarios(usuariosAtualizados)

      if (formCriar.role === 'tecnico' || formCriar.role === 'analista') {
        const tecnicos = JSON.parse(localStorage.getItem('tecnicos') || '[]')
        tecnicos.push({
          id: usuarioCriado.uid,
          nome: formCriar.nome,
          email: formCriar.email,
          telefone: '',
          especialidade: formCriar.equipe,
          disponivel: true,
          equipe: formCriar.equipe
        })
        localStorage.setItem('tecnicos', JSON.stringify(tecnicos))
      }
    }

    const nomeEquipe = formCriar.role === 'admin' ? 'Master' : EQUIPES.find(e => e.id === formCriar.equipe)?.label
    const nomePerfil = PERFIS.find(p => p.id === formCriar.role)?.label
    setSuccess(`✅ ${formCriar.nome} criado como ${nomePerfil}${formCriar.role === 'admin' ? '!' : ` de ${nomeEquipe}!`}`)
    setFormCriar({
      nome: '',
      email: '',
      senha: '',
      confirmarSenha: '',
      equipe: userData?.equipe || 'suporte',
      role: 'tecnico'
    })
    setShowFormCriar(false)
    
    // ✅ RECARREGAR APÓS 2 SEGUNDOS PARA SINCRONIZAR
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    if (err.message.includes('email-already-in-use')) {
      setError('❌ Este e-mail já está cadastrado')
    } else if (err.message.includes('invalid-email')) {
      setError('❌ E-mail inválido')
    } else if (err.message.includes('weak-password')) {
      setError('❌ Senha muito fraca')
    } else {
      setError(`❌ Erro: ${err.message}`)
    }
  } finally {
    setCriando(false)
  }
}

  const handleEditarUsuario = async (e) => {
  e.preventDefault()
  setError('')
  setSuccess('')
  setEditando(true)

  if (!formEditar.nome.trim()) {
    setError('Nome é obrigatório')
    setEditando(false)
    return
  }

  // ✅ VALIDAÇÃO: Apenas Admin pode alterar para Admin
  if (formEditar.role === 'admin' && userData?.role !== 'admin') {
    setError('❌ Apenas Admin pode promover para Administrador')
    setEditando(false)
    return
  }

  try {
    const usuariosAtualizados = usuarios.map(u => {
      if (u.uid === usuarioEditando.uid) {
        const usuarioAtualizado = {
          ...u,
          nome: formEditar.nome,
          role: formEditar.role
        }
        
        // ✅ Admin NÃO precisa de equipe
        if (formEditar.role === 'admin') {
          usuarioAtualizado.equipe = null
        } else {
          usuarioAtualizado.equipe = formEditar.equipe
        }
        
        return usuarioAtualizado
      }
      return u
    })
    localStorage.setItem('usuarios', JSON.stringify(usuariosAtualizados))
    setUsuarios(usuariosAtualizados)
    setSuccess(`✅ ${formEditar.nome} atualizado com sucesso!`)
    setShowFormEditar(false)
    setUsuarioEditando(null)
  } catch (err) {
    setError(`❌ Erro ao editar: ${err.message}`)
  } finally {
    setEditando(false)
  }
}
 const handleDelete = async (uid) => {
  if (!window.confirm('Tem certeza que deseja deletar este usuário?')) return

  try {
    if (user?.uid === uid) {
      alert('Você não pode deletar sua própria conta!')
      return
    }

    // 1. Deletar do localStorage
    const usuariosAtualizados = usuarios.filter(u => u.uid !== uid)
    localStorage.setItem('usuarios', JSON.stringify(usuariosAtualizados))
    setUsuarios(usuariosAtualizados)

    // 2. Deletar do técnicos também
    const tecnicos = JSON.parse(localStorage.getItem('tecnicos') || '[]')
    const tecnicosAtualizados = tecnicos.filter(t => t.id !== uid)
    localStorage.setItem('tecnicos', JSON.stringify(tecnicosAtualizados))

    // 3. ✅ DELETAR DO FIREBASE
    try {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${import.meta.env.VITE_FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: await user.getIdToken()
        })
      })
      
      if (!response.ok) {
        console.warn('⚠️ Não foi possível deletar do Firebase, mas foi removido do localStorage')
      }
    } catch (firebaseError) {
      console.warn('⚠️ Erro ao deletar do Firebase:', firebaseError)
    }

    setSuccess('✅ Usuário deletado com sucesso!')
    
    setTimeout(() => {
      setSuccess('')
    }, 3000)
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    setError('❌ Erro ao deletar usuário')
  }
}

  // ✅ NÃO FILTRAR POR EQUIPE AQUI - O FILTRO JÁ ESTÁ EM usuariosVisiveis()
const usuariosFiltrados = usuarios

  if (loading) {
    return <div className="usuarios-container"><p>Carregando usuários...</p></div>
  }

  const podeEditar = podecriarUsuario()

  // ✅ PROBLEMA 3: GESTORES VEEM APENAS OUTROS GESTORES + SUA EQUIPE
  const usuariosVisiveis = () => {
  // Admin vê todos
  if (userData?.role === 'admin') {
    return usuariosFiltrados
  }

  // Gestor vê: Técnicos/Analistas de sua equipe + Outros Gestores da MESMA equipe
  if (userData?.role === 'gestor') {
    return usuariosFiltrados.filter(u => {
      // Vê Técnicos e Analistas de sua equipe
      if (u.equipe === userData.equipe && (u.role === 'tecnico' || u.role === 'analista')) {
        return true
      }
      // Vê APENAS Gestores da MESMA equipe (não de outras equipes)
      if (u.role === 'gestor' && u.equipe === userData.equipe && u.uid !== userData.uid) {
        return true
      }
      return false
    })
  }

  // Técnico/Analista não vê ninguém
  return []
}

  return (
    <div className="usuarios-container">
      <div className="usuarios-header">
        <div>
          <h2>Gerenciar Usuários</h2>
          <p className="subtitle">Total de usuários: {usuarios.length}</p>
        </div>
        {podeEditar && (
          <button className="btn-primary" onClick={() => setShowFormCriar(!showFormCriar)}>
            {showFormCriar ? '✕ Cancelar' : '+ Novo Usuário'}
          </button>
        )}
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {/* FORMULÁRIO CRIAR */}
      {/* FORMULÁRIO CRIAR */}
{podeEditar && showFormCriar && (
  <form className="usuario-form" onSubmit={handleCriarUsuario}>
    <h3>Criar Novo Usuário</h3>
    <div className="form-row">
      <div className="form-group">
        <label>Nome Completo *</label>
        <input
          type="text"
          value={formCriar.nome}
          onChange={(e) => setFormCriar({...formCriar, nome: e.target.value})}
          placeholder="João Silva"
          required
          disabled={criando}
          autoComplete="off"
        />
      </div>
      <div className="form-group">
        <label>E-mail *</label>
        <input
          type="email"
          value={formCriar.email}
          onChange={(e) => setFormCriar({...formCriar, email: e.target.value})}
          placeholder="joao@escala.com"
          required
          disabled={criando}
          autoComplete="off"
        />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Senha *</label>
        <input
          type="password"
          value={formCriar.senha}
          onChange={(e) => setFormCriar({...formCriar, senha: e.target.value})}
          placeholder="Mínimo 6 caracteres"
          required
          disabled={criando}
          autoComplete="off"
        />
      </div>
      <div className="form-group">
        <label>Confirmar Senha *</label>
        <input
          type="password"
          value={formCriar.confirmarSenha}
          onChange={(e) => setFormCriar({...formCriar, confirmarSenha: e.target.value})}
          placeholder="Confirme a senha"
          required
          disabled={criando}
          autoComplete="off"
        />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Perfil *</label>
        <select
          value={formCriar.role}
          onChange={(e) => setFormCriar({...formCriar, role: e.target.value})}
          required
          disabled={criando}
        >
          {perfisDisponiveis().map(perfil => (
            <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
          ))}
        </select>
      </div>
      
      {/* ✅ MOSTRAR EQUIPE APENAS SE NÃO FOR ADMIN */}
      {formCriar.role !== 'admin' && (
        <div className="form-group">
          <label>Equipe *</label>
          <select
            value={formCriar.equipe}
            onChange={(e) => setFormCriar({...formCriar, equipe: e.target.value})}
            required
            disabled={criando}
          >
            {equipesDisponiveis().map(eq => (
              <option key={eq.id} value={eq.id}>{eq.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
    <div className="form-actions">
      <button type="submit" className="btn-success" disabled={criando}>
        {criando ? '⏳ Criando...' : '✅ Criar Usuário'}
      </button>
      <button type="button" className="btn-secondary" onClick={() => setShowFormCriar(false)} disabled={criando}>
        Cancelar
      </button>
    </div>
  </form>
)}

      {/* FORMULÁRIO EDITAR */}
      {/* FORMULÁRIO EDITAR */}
{showFormEditar && usuarioEditando && (
  <form className="usuario-form" onSubmit={handleEditarUsuario}>
    <h3>Editar Usuário: {usuarioEditando.nome}</h3>
    <div className="form-row">
      <div className="form-group">
        <label>Nome Completo *</label>
        <input
          type="text"
          value={formEditar.nome}
          onChange={(e) => setFormEditar({...formEditar, nome: e.target.value})}
          placeholder="João Silva"
          required
          disabled={editando}
          autoComplete="off"
        />
      </div>
      <div className="form-group">
        <label>E-mail (não editável)</label>
        <input
          type="email"
          value={usuarioEditando.email}
          disabled
          style={{backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
        />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Perfil *</label>
        <select
          value={formEditar.role}
          onChange={(e) => setFormEditar({...formEditar, role: e.target.value})}
          required
          disabled={editando}
        >
          {perfisDisponiveis().map(perfil => (
            <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
          ))}
        </select>
      </div>
      
      {/* ✅ MOSTRAR EQUIPE APENAS SE NÃO FOR ADMIN */}
      {formEditar.role !== 'admin' && (
        <div className="form-group">
          <label>Equipe *</label>
          <select
            value={formEditar.equipe}
            onChange={(e) => setFormEditar({...formEditar, equipe: e.target.value})}
            required
            disabled={editando}
          >
            {equipesDisponiveis().map(eq => (
              <option key={eq.id} value={eq.id}>{eq.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
    <div className="form-actions">
      <button type="submit" className="btn-success" disabled={editando}>
        {editando ? '⏳ Salvando...' : '💾 Salvar Alterações'}
      </button>
      <button type="button" className="btn-secondary" onClick={() => {setShowFormEditar(false); setUsuarioEditando(null)}} disabled={editando}>
        Cancelar
      </button>
    </div>
  </form>
)}
      {/* TABELA DE USUÁRIOS */}
      <div className="usuarios-section">
        <div className="filtro-header">
          <h3>Usuários Cadastrados</h3>
          {userData?.role === 'admin' && (
            <div className="filtros">
              <button
                className={filtroEquipe === 'todos' ? 'active' : ''}
                onClick={() => setFiltroEquipe('todos')}
              >
                Todos
              </button>
              {EQUIPES.map(eq => (
                <button
                  key={eq.id}
                  className={filtroEquipe === eq.id ? 'active' : ''}
                  onClick={() => setFiltroEquipe(eq.id)}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="usuarios-table-wrapper">
          {usuariosVisiveis().length === 0 ? (
            <p className="empty-state">Nenhum usuário para exibir</p>
          ) : (
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Equipe</th>
                  <th>Perfil</th>
                  {podeEditar && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {usuariosVisiveis().map(usuario => (
                  <tr key={usuario.uid}>
                    <td className="nome-cell">
                      <strong>{usuario.nome}</strong>
                    </td>
                    <td>{usuario.email}</td>
                    <td>
                      <span className="equipe-badge" style={{background: EQUIPES.find(e => e.id === usuario.equipe)?.cor}}>
                        {EQUIPES.find(e => e.id === usuario.equipe)?.label}
                      </span>
                    </td>
                    <td>
                      <span className={`role-badge ${usuario.role}`}>
                        {PERFIS.find(p => p.id === usuario.role)?.label}
                      </span>
                    </td>
                    {podeEditar && (
                      <td>
                        <div className="acoes">
                          {usuario.role !== 'admin' && usuario.uid !== userData.uid && (
                            <>
                              <button
                                className="btn-editar"
                                onClick={() => abrirEditar(usuario)}
                                title="Editar usuário"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                className="btn-delete"
                                onClick={() => handleDelete(usuario.uid)}
                                title="Deletar usuário"
                              >
                                🗑️ Deletar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DASHBOARD - APENAS EQUIPES REAIS */}
      <div className="usuarios-stats">
        {EQUIPES.map(eq => {
          const count = usuarios.filter(u => u.equipe === eq.id).length
          const gestores = usuarios.filter(u => u.equipe === eq.id && u.role === 'gestor').length
          return (
            <div key={eq.id} className="stat-card" style={{borderLeftColor: eq.cor}}>
              <span className="stat-label">{eq.label}</span>
              <span className="stat-number">{count}</span>
              <span className="stat-sub">{gestores} gestor(es)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}