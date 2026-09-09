'use client'

import { useState, useEffect } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import {
  EQUIPES,
  PERFIS,
  perfisColaboradorPorEquipe,
  especialidadesPorEquipe,
  labelEquipe,
  corEquipe,
  labelPerfil,
} from '../../lib/equipesConfig'
import '../../styles/Usuarios.css'

const CUSTOM = '__custom__'

export default function Usuarios() {
  const { user, userData } = useDashboardUser()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFormCriar, setShowFormCriar] = useState(false)
  const [showFormEditar, setShowFormEditar] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [filtroEquipe, setFiltroEquipe] = useState('todos')

  const formVazioCriar = {
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    matricula: '',
    equipe: 'suporte',
    role: 'tecnico',
    roleCustom: '',
    especialidade: '',
    especialidadeCustom: '',
  }
  const [formCriar, setFormCriar] = useState(formVazioCriar)
  const [formEditar, setFormEditar] = useState({
    nome: '',
    matricula: '',
    equipe: 'suporte',
    role: 'tecnico',
    roleCustom: '',
    especialidade: '',
    especialidadeCustom: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [excluindoUid, setExcluindoUid] = useState(null)

  const souAdmin = userData?.role === 'admin'

  useEffect(() => {
    if (userData) {
      const equipeInicial = userData.equipe || 'suporte'
      const perfis = perfisDisponiveis(equipeInicial)
      setFormCriar(prev => ({
        ...prev,
        equipe: equipeInicial,
        role: perfis.some(p => p.id === prev.role) ? prev.role : (perfis[0]?.id || prev.role),
      }))
    }
    carregarUsuarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const carregarUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios')
      const dados = await response.json()
      setUsuarios(dados)
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      setLoading(false)
    }
  }

  const podecriarUsuario = () => {
    if (!userData) return false
    return userData.role === 'admin' || userData.role === 'gestor'
  }

  const equipesDisponiveis = () => {
    if (!userData) return EQUIPES
    if (userData.role === 'admin') return EQUIPES
    if (userData.role === 'gestor') return EQUIPES.filter(e => e.id === userData.equipe)
    return []
  }

  // Perfis que fazem sentido pra equipe escolhida (fora do admin, que vê tudo + "Outro")
  const perfisDisponiveis = (equipe) => {
    if (souAdmin) return [...PERFIS, { id: CUSTOM, label: '✏️ Outro (digitar)' }]

    const permitidos = perfisColaboradorPorEquipe(equipe)
    return PERFIS.filter(p => p.id === 'gestor' || permitidos.includes(p.id))
  }

  const especialidadesDisponiveis = (equipe) => especialidadesPorEquipe(equipe)

  const abrirEditar = (usuario) => {
    setUsuarioEditando(usuario)
    const roleConhecido = PERFIS.some(p => p.id === usuario.role)
    setFormEditar({
      nome: usuario.nome,
      matricula: usuario.matricula || '',
      equipe: usuario.equipe || 'suporte',
      role: roleConhecido ? usuario.role : CUSTOM,
      roleCustom: roleConhecido ? '' : usuario.role,
      especialidade: especialidadesDisponiveis(usuario.equipe).includes(usuario.especialidade) ? usuario.especialidade : (usuario.especialidade ? CUSTOM : ''),
      especialidadeCustom: especialidadesDisponiveis(usuario.equipe).includes(usuario.especialidade) ? '' : (usuario.especialidade || ''),
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

    const roleFinal = formCriar.role === CUSTOM ? formCriar.roleCustom.trim() : formCriar.role
    if (!roleFinal) {
      setError('Informe o perfil')
      setCriando(false)
      return
    }
    const especialidadeFinal = formCriar.especialidade === CUSTOM ? formCriar.especialidadeCustom.trim() : formCriar.especialidade

    if (roleFinal === 'admin' && userData?.role !== 'admin') {
      setError('❌ Apenas Admin pode criar contas de Administrador')
      setCriando(false)
      return
    }

    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formCriar.nome,
          email: formCriar.email,
          senha: formCriar.senha,
          role: roleFinal,
          equipe: roleFinal === 'admin' ? null : formCriar.equipe,
          matricula: formCriar.matricula || null,
          especialidade: especialidadeFinal || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao criar usuário')
      }

      await carregarUsuarios()

      const nomeEquipe = roleFinal === 'admin' ? 'Master' : labelEquipe(formCriar.equipe)
      setSuccess(`✅ ${formCriar.nome} criado como ${labelPerfil(roleFinal)}${roleFinal === 'admin' ? '!' : ` de ${nomeEquipe}!`}`)
      setFormCriar({ ...formVazioCriar, equipe: userData?.equipe || 'suporte' })
      setShowFormCriar(false)
    } catch (err) {
      console.error('❌ Erro:', err.message)
      if (err.message.includes('email-already-in-use')) {
        setError('❌ Este e-mail já está cadastrado')
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

    const roleFinal = formEditar.role === CUSTOM ? formEditar.roleCustom.trim() : formEditar.role
    if (!roleFinal) {
      setError('Informe o perfil')
      setEditando(false)
      return
    }
    const especialidadeFinal = formEditar.especialidade === CUSTOM ? formEditar.especialidadeCustom.trim() : formEditar.especialidade

    if (roleFinal === 'admin' && userData?.role !== 'admin') {
      setError('❌ Apenas Admin pode promover para Administrador')
      setEditando(false)
      return
    }

    try {
      const response = await fetch(`/api/usuarios/${encodeURIComponent(usuarioEditando.uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formEditar.nome,
          role: roleFinal,
          equipe: roleFinal === 'admin' ? null : formEditar.equipe,
          matricula: formEditar.matricula || null,
          especialidade: especialidadeFinal || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao editar usuário')
      }

      await carregarUsuarios()
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

    if (user?.uid === uid) {
      alert('Você não pode deletar sua própria conta!')
      return
    }

    setError('')
    setSuccess('')
    setExcluindoUid(uid)
    try {
      const response = await fetch(`/api/usuarios/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao deletar usuário')
      }

      await carregarUsuarios()
      setSuccess('✅ Usuário deletado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      setError(`❌ Erro ao deletar usuário: ${error.message}`)
    } finally {
      setExcluindoUid(null)
    }
  }

  if (loading) {
    return <div className="usuarios-container"><p>Carregando usuários...</p></div>
  }

  const podeEditar = podecriarUsuario()

  const usuariosVisiveis = () => {
    if (userData?.role === 'admin') {
      return usuarios
    }
    if (userData?.role === 'gestor') {
      return usuarios.filter(u => {
        if (u.equipe === userData.equipe && u.role !== 'admin' && u.role !== 'gestor') {
          return true
        }
        if (u.role === 'gestor' && u.equipe === userData.equipe && u.uid !== userData.uid) {
          return true
        }
        return false
      })
    }
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
              <label>Matrícula</label>
              <input
                type="text"
                value={formCriar.matricula}
                onChange={(e) => setFormCriar({...formCriar, matricula: e.target.value})}
                placeholder="Ex: 00123"
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
                {perfisDisponiveis(formCriar.equipe).map(perfil => (
                  <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
                ))}
              </select>
              {formCriar.role === CUSTOM && (
                <input
                  type="text"
                  value={formCriar.roleCustom}
                  onChange={(e) => setFormCriar({...formCriar, roleCustom: e.target.value})}
                  placeholder="Digite o nome do perfil"
                  className="campo-custom"
                  disabled={criando}
                />
              )}
            </div>

            {formCriar.role !== 'admin' && (
              <div className="form-group">
                <label>Equipe *</label>
                <select
                  value={formCriar.equipe}
                  onChange={(e) => {
                    const novaEquipe = e.target.value
                    const perfis = perfisDisponiveis(novaEquipe)
                    setFormCriar({
                      ...formCriar,
                      equipe: novaEquipe,
                      role: perfis.some(p => p.id === formCriar.role) ? formCriar.role : (perfis[0]?.id || formCriar.role),
                      especialidade: '',
                      especialidadeCustom: '',
                    })
                  }}
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
          {formCriar.role !== 'admin' && (especialidadesDisponiveis(formCriar.equipe).length > 0 || souAdmin) && (
            <div className="form-row">
              <div className="form-group">
                <label>Especialidade</label>
                <select
                  value={formCriar.especialidade}
                  onChange={(e) => setFormCriar({...formCriar, especialidade: e.target.value})}
                  disabled={criando}
                >
                  <option value="">— Sem especialidade —</option>
                  {especialidadesDisponiveis(formCriar.equipe).map(esp => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                  {souAdmin && <option value={CUSTOM}>✏️ Outro (digitar)</option>}
                </select>
                {formCriar.especialidade === CUSTOM && (
                  <input
                    type="text"
                    value={formCriar.especialidadeCustom}
                    onChange={(e) => setFormCriar({...formCriar, especialidadeCustom: e.target.value})}
                    placeholder="Digite a especialidade"
                    className="campo-custom"
                    disabled={criando}
                  />
                )}
              </div>
            </div>
          )}
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
              <label>Matrícula</label>
              <input
                type="text"
                value={formEditar.matricula}
                onChange={(e) => setFormEditar({...formEditar, matricula: e.target.value})}
                placeholder="Ex: 00123"
                disabled={editando}
                autoComplete="off"
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
                {(!souAdmin && formEditar.role === CUSTOM
                  ? [...perfisDisponiveis(formEditar.equipe), { id: CUSTOM, label: '✏️ Perfil personalizado' }]
                  : perfisDisponiveis(formEditar.equipe)
                ).map(perfil => (
                  <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
                ))}
              </select>
              {formEditar.role === CUSTOM && (
                <input
                  type="text"
                  value={formEditar.roleCustom}
                  onChange={(e) => setFormEditar({...formEditar, roleCustom: e.target.value})}
                  placeholder="Digite o nome do perfil"
                  className="campo-custom"
                  disabled={editando}
                />
              )}
            </div>

            {formEditar.role !== 'admin' && (
              <div className="form-group">
                <label>Equipe *</label>
                <select
                  value={formEditar.equipe}
                  onChange={(e) => {
                    const novaEquipe = e.target.value
                    const perfis = perfisDisponiveis(novaEquipe)
                    setFormEditar({
                      ...formEditar,
                      equipe: novaEquipe,
                      role: perfis.some(p => p.id === formEditar.role) ? formEditar.role : (perfis[0]?.id || formEditar.role),
                      especialidade: '',
                      especialidadeCustom: '',
                    })
                  }}
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
          {formEditar.role !== 'admin' && (especialidadesDisponiveis(formEditar.equipe).length > 0 || souAdmin || formEditar.especialidade === CUSTOM) && (
            <div className="form-row">
              <div className="form-group">
                <label>Especialidade</label>
                <select
                  value={formEditar.especialidade}
                  onChange={(e) => setFormEditar({...formEditar, especialidade: e.target.value})}
                  disabled={editando}
                >
                  <option value="">— Sem especialidade —</option>
                  {especialidadesDisponiveis(formEditar.equipe).map(esp => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                  {(souAdmin || formEditar.especialidade === CUSTOM) && <option value={CUSTOM}>✏️ Outro (digitar)</option>}
                </select>
                {formEditar.especialidade === CUSTOM && (
                  <input
                    type="text"
                    value={formEditar.especialidadeCustom}
                    onChange={(e) => setFormEditar({...formEditar, especialidadeCustom: e.target.value})}
                    placeholder="Digite a especialidade"
                    className="campo-custom"
                    disabled={editando}
                  />
                )}
              </div>
            </div>
          )}
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
          {usuariosVisiveis().filter(u => filtroEquipe === 'todos' || u.equipe === filtroEquipe).length === 0 ? (
            <p className="empty-state">Nenhum usuário para exibir</p>
          ) : (
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Matrícula</th>
                  <th>Equipe</th>
                  <th>Perfil</th>
                  <th>Especialidade</th>
                  {podeEditar && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {usuariosVisiveis().filter(u => filtroEquipe === 'todos' || u.equipe === filtroEquipe).map(usuario => (
                  <tr key={usuario.uid}>
                    <td className="nome-cell">
                      <strong>{usuario.nome}</strong>
                    </td>
                    <td>{usuario.email}</td>
                    <td>{usuario.matricula || '-'}</td>
                    <td>
                      {usuario.equipe ? (
                        <span className="equipe-badge" style={{background: corEquipe(usuario.equipe)}}>
                          {labelEquipe(usuario.equipe)}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`role-badge ${usuario.role}`}>
                        {labelPerfil(usuario.role)}
                      </span>
                    </td>
                    <td>{usuario.especialidade || '-'}</td>
                    {podeEditar && (
                      <td>
                        <div className="acoes">
                          {usuario.role !== 'admin' && usuario.uid !== userData.uid && (
                            <>
                              <button
                                className="btn-editar"
                                onClick={() => abrirEditar(usuario)}
                                title="Editar usuário"
                                disabled={excluindoUid === usuario.uid}
                              >
                                ✏️ Editar
                              </button>
                              <button
                                className="btn-delete"
                                onClick={() => handleDelete(usuario.uid)}
                                title="Deletar usuário"
                                disabled={excluindoUid === usuario.uid}
                              >
                                {excluindoUid === usuario.uid ? '⏳ Excluindo...' : '🗑️ Deletar'}
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
