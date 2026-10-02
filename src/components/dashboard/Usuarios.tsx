'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import { useNotificacao } from '../../context/NotificacaoContext'
import {
  EQUIPES,
  PERFIS,
  perfisColaboradorPorEquipe,
  especialidadesPorEquipe,
  labelEquipe,
  corEquipe,
  labelPerfil,
  ehPerfilGestao,
} from '../../lib/equipesConfig'
import { DIAS_SEMANA, ehJovemAprendiz } from '../../lib/escalasConstants'
import { mensagemDeErro } from '../../lib/erros'
import type { Usuario } from '../../types/dominio'
import '../../styles/Usuarios.css'

const CUSTOM = '__custom__'

interface FormUsuario {
  nome: string
  matricula: string
  equipe: string
  role: string
  roleCustom: string
  especialidade: string
  especialidadeCustom: string
  horarioEntrada: string
  baia: string
  baiaFixa: boolean
  elegivelHomeOffice: boolean
  diaCurso: number | string
  feriasInicio: string
  feriasFim: string
}

export default function Usuarios() {
  const { user, userData } = useDashboardUser()
  const { notificar, confirmar } = useNotificacao()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormEditar, setShowFormEditar] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [filtroEquipe, setFiltroEquipe] = useState('todos')
  const [busca, setBusca] = useState('')

  const [formEditar, setFormEditar] = useState<FormUsuario>({
    nome: '',
    matricula: '',
    equipe: 'suporte',
    role: 'tecnico',
    roleCustom: '',
    especialidade: '',
    especialidadeCustom: '',
    horarioEntrada: '',
    baia: '',
    baiaFixa: false,
    elegivelHomeOffice: true,
    diaCurso: '',
    feriasInicio: '',
    feriasFim: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editando, setEditando] = useState(false)
  const [excluindoUid, setExcluindoUid] = useState<string | null>(null)

  const souAdmin = userData?.role === 'admin'

  useEffect(() => {
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
    return ehPerfilGestao(userData.role)
  }

  const equipesDisponiveis = () => {
    if (!userData) return EQUIPES
    if (userData.role === 'admin') return EQUIPES
    if (userData.role === 'gestor' || userData.role === 'lider') return EQUIPES.filter(e => e.id === userData.equipe)
    return []
  }

  // Perfis que fazem sentido pra equipe escolhida — gestor/líder/admin
  // sempre aparecem (são equipe-agnósticos), o resto depende da equipe.
  // "Admin" só aparece pra quem já é admin, e só admin ganha a opção de
  // digitar um perfil novo ("Outro").
  const perfisDisponiveis = (equipe: string | null | undefined) => {
    const permitidos = perfisColaboradorPorEquipe(equipe)
    const base = PERFIS.filter(p => {
      if (p.id === 'admin') return souAdmin
      if (p.id === 'gestor' || p.id === 'lider') return true
      return permitidos.includes(p.id)
    })
    return souAdmin ? [...base, { id: CUSTOM, label: '✏️ Outro (digitar)' }] : base
  }

  // Lista base (padrão) + qualquer especialidade que já esteja em uso por
  // alguém da equipe (ex: digitada via "Outro" antes) — assim, uma vez
  // criada, ela já aparece pronta pro próximo cadastro, sem precisar
  // mexer em código.
  const especialidadesDisponiveis = (equipe: string | null | undefined): string[] => {
    const padrao = especialidadesPorEquipe(equipe)
    const emUso = usuarios.filter(u => u.equipe === equipe && u.especialidade).map(u => u.especialidade)
    const extras = [...new Set(emUso)].filter(esp => !padrao.includes(esp))
    return [...padrao, ...extras]
  }

  // Valida o período de férias antes mesmo de tentar salvar, pra dar
  // feedback imediato em vez de só descobrir o erro depois do envio.
  const validarFerias = (inicio: string, fim: string) => {
    if (!inicio && !fim) return null
    if (!inicio || !fim) return '❌ Preencha as duas datas de férias (início e fim), ou deixe as duas em branco'
    if (fim < inicio) return '❌ A data de fim das férias não pode ser antes da data de início'
    return null
  }

  const abrirEditar = (usuario: Usuario) => {
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
      horarioEntrada: usuario.horarioEntrada || '',
      baia: usuario.baia || '',
      baiaFixa: Boolean(usuario.baiaFixa),
      elegivelHomeOffice: usuario.elegivelHomeOffice !== false,
      diaCurso: usuario.diaCurso ?? '',
      feriasInicio: usuario.feriasInicio || '',
      feriasFim: usuario.feriasFim || '',
    })
    setShowFormEditar(true)
  }

  const handleEditarUsuario = async (e: FormEvent<HTMLFormElement>) => {
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

    const erroFerias = validarFerias(formEditar.feriasInicio, formEditar.feriasFim)
    if (erroFerias) {
      setError(erroFerias)
      setEditando(false)
      return
    }

    try {
      const response = await fetch(`/api/usuarios/${encodeURIComponent(String(usuarioEditando?.uid))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formEditar.nome,
          role: roleFinal,
          equipe: roleFinal === 'admin' ? null : formEditar.equipe,
          matricula: formEditar.matricula || null,
          especialidade: especialidadeFinal || null,
          horarioEntrada: formEditar.horarioEntrada || null,
          baia: formEditar.baia || null,
          baiaFixa: formEditar.baiaFixa,
          elegivelHomeOffice: formEditar.elegivelHomeOffice,
          diaCurso: formEditar.diaCurso === '' ? null : formEditar.diaCurso,
          feriasInicio: formEditar.feriasInicio || null,
          feriasFim: formEditar.feriasFim || null,
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
      setError(`❌ Erro ao editar: ${mensagemDeErro(err)}`)
    } finally {
      setEditando(false)
    }
  }

  // Desativar no lugar de excluir — excluir de vez trava quando a pessoa já
  // tem histórico (trocas, rodízio), e some com o rastro dela. Desativada,
  // ela só para de entrar em escala/rodízio novos, mas o histórico continua
  // intacto. Reenvia o registro inteiro (igual o formulário de editar faz),
  // só com "ativo" trocado — o PATCH sempre regrava tudo de uma vez.
  const handleToggleAtivo = async (usuario: Usuario) => {
    const vaiAtivar = !usuario.ativo
    const mensagemConfirmacao = vaiAtivar
      ? `Reativar ${usuario.nome}? Ela volta a poder ser escalada.`
      : `Desativar ${usuario.nome}? Ela para de entrar em escala/rodízio novos (o histórico dela continua intacto).`
    if (!(await confirmar(mensagemConfirmacao, { titulo: vaiAtivar ? 'Reativar usuário' : 'Desativar usuário', textoConfirmar: vaiAtivar ? 'Reativar' : 'Desativar' }))) return

    if (user?.uid === usuario.uid) {
      notificar('Você não pode desativar sua própria conta!', { tipo: 'erro' })
      return
    }

    setError('')
    setSuccess('')
    setExcluindoUid(usuario.uid)
    try {
      const response = await fetch(`/api/usuarios/${encodeURIComponent(usuario.uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: usuario.nome,
          role: usuario.role,
          equipe: usuario.role === 'admin' ? null : usuario.equipe,
          matricula: usuario.matricula || null,
          especialidade: usuario.especialidade || null,
          horarioEntrada: usuario.horarioEntrada || null,
          baia: usuario.baia || null,
          baiaFixa: usuario.baiaFixa,
          elegivelHomeOffice: usuario.elegivelHomeOffice,
          diaCurso: usuario.diaCurso ?? null,
          feriasInicio: usuario.feriasInicio || null,
          feriasFim: usuario.feriasFim || null,
          ativo: vaiAtivar,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao atualizar usuário')
      }

      await carregarUsuarios()
      setSuccess(vaiAtivar ? '✅ Usuário reativado!' : '✅ Usuário desativado!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erro ao desativar/reativar usuário:', error)
      setError(`❌ Erro: ${mensagemDeErro(error)}`)
    } finally {
      setExcluindoUid(null)
    }
  }

  if (loading) {
    return <div className="usuarios-container"><p>Carregando usuários...</p></div>
  }

  const podeEditar = podecriarUsuario()
  // Editando a própria conta: trava perfil/equipe (não dá pra se
  // rebaixar/mudar de equipe sozinho), mas libera os outros campos —
  // matrícula, especialidade, horário, baia, férias.
  const editandoAMimMesmo = usuarioEditando?.uid === userData?.uid

  const usuariosVisiveis = () => {
    if (userData?.role === 'admin') {
      return usuarios
    }
    if (userData?.role === 'gestor' || userData?.role === 'lider') {
      return usuarios.filter(u => {
        if (u.equipe === userData.equipe && u.role !== 'admin' && u.role !== 'gestor' && u.role !== 'lider') {
          return true
        }
        if ((u.role === 'gestor' || u.role === 'lider') && u.equipe === userData.equipe) {
          return true
        }
        return false
      })
    }
    return []
  }

  // Busca ignora maiúsculas/minúsculas e acento (ex: "jose" acha "José") —
  // nome ou matrícula, qualquer um dos dois batendo já mostra.
  const normalizarBusca = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const buscaNormalizada = normalizarBusca(busca.trim())
  const usuariosFiltrados = usuariosVisiveis()
    .filter(u => filtroEquipe === 'todos' || u.equipe === filtroEquipe)
    .filter(u => !buscaNormalizada || normalizarBusca(u.nome).includes(buscaNormalizada) || normalizarBusca(u.matricula || '').includes(buscaNormalizada))

  return (
    <div className="usuarios-container">
      <div className="usuarios-header">
        <div>
          <h2>Gerenciar Usuários</h2>
          <p className="subtitle">Total de usuários: {usuarios.length}</p>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}


      {/* FORMULÁRIO EDITAR */}
      {showFormEditar && usuarioEditando && (
        <div className="modal-overlay" onClick={() => { setShowFormEditar(false); setUsuarioEditando(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Usuário: {usuarioEditando.nome}</h3>
              <button className="modal-close" onClick={() => { setShowFormEditar(false); setUsuarioEditando(null) }}>✕</button>
            </div>
            {error && <p className="error-message" style={{ margin: '0 20px' }}>{error}</p>}
            {success && <p className="success-message" style={{ margin: '0 20px' }}>{success}</p>}
            <form className="usuario-form usuario-form-modal" onSubmit={handleEditarUsuario}>
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
          {editandoAMimMesmo && (
            <p className="error-message" style={{ margin: '0 20px 15px', background: '#fff3cd', color: '#856404', borderLeft: '4px solid #f39c12' }}>
              ⚠️ Você está editando a própria conta — perfil e equipe ficam travados (só um admin pode mudar isso).
            </p>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Perfil *</label>
              <select
                value={formEditar.role}
                onChange={(e) => setFormEditar({...formEditar, role: e.target.value})}
                required
                disabled={editando || editandoAMimMesmo}
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
                  disabled={editando || editandoAMimMesmo}
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
                  disabled={editando || editandoAMimMesmo}
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
              {ehJovemAprendiz(formEditar.role) && (
                <div className="form-group">
                  <label>Dia do curso</label>
                  <select
                    value={formEditar.diaCurso}
                    onChange={(e) => setFormEditar({...formEditar, diaCurso: e.target.value})}
                    disabled={editando}
                  >
                    <option value="">— Sem dia de curso —</option>
                    {DIAS_SEMANA.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {formEditar.role !== 'admin' && (
            <div className="form-row">
              <div className="form-group">
                <label>Horário de Entrada</label>
                <input
                  type="time"
                  value={formEditar.horarioEntrada}
                  onChange={(e) => setFormEditar({...formEditar, horarioEntrada: e.target.value})}
                  disabled={editando}
                />
              </div>
              <div className="form-group">
                <label>Preferência de baia</label>
                <select
                  value={formEditar.baia}
                  onChange={(e) => setFormEditar({...formEditar, baia: e.target.value})}
                  disabled={editando}
                >
                  <option value="">— Sem baia —</option>
                  <option value="0">⭐ Supervisor (baia especial)</option>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>Baia {n}</option>
                  ))}
                </select>
                {formEditar.baia === '0' ? (
                  <p className="campo-nota">É a baia especial do Supervisor: fica fixo automaticamente e nunca entra no rodízio de escala.</p>
                ) : (
                  <>
                    <label className="campo-toggle">
                      <span className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={formEditar.baiaFixa}
                          onChange={(e) => setFormEditar({...formEditar, baiaFixa: e.target.checked})}
                          disabled={editando}
                        />
                        <span className="toggle-switch-slider"></span>
                      </span>
                      <span>Baia fixa: essa baia é só dele. Sempre volta pra ela quando ela estiver livre e ele presencial</span>
                    </label>
                    <label className="campo-toggle">
                      <span className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={!formEditar.elegivelHomeOffice}
                          onChange={(e) => setFormEditar({...formEditar, elegivelHomeOffice: !e.target.checked})}
                          disabled={editando}
                        />
                        <span className="toggle-switch-slider"></span>
                      </span>
                      <span>Home office suspenso</span>
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
          {formEditar.role !== 'admin' && (
            <div className="form-row">
              <div className="form-group">
                <label>Férias - Início</label>
                <input
                  type="date"
                  value={formEditar.feriasInicio}
                  onChange={(e) => setFormEditar({...formEditar, feriasInicio: e.target.value})}
                  disabled={editando}
                />
              </div>
              <div className="form-group">
                <label>Férias - Fim</label>
                <input
                  type="date"
                  value={formEditar.feriasFim}
                  onChange={(e) => setFormEditar({...formEditar, feriasFim: e.target.value})}
                  disabled={editando}
                  style={validarFerias(formEditar.feriasInicio, formEditar.feriasFim) ? { borderColor: '#c0392b' } : {}}
                />
              </div>
              {validarFerias(formEditar.feriasInicio, formEditar.feriasFim) && (
                <p className="error-message" style={{ gridColumn: '1 / -1', margin: 0 }}>
                  {validarFerias(formEditar.feriasInicio, formEditar.feriasFim)}
                </p>
              )}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-success" disabled={editando || Boolean(validarFerias(formEditar.feriasInicio, formEditar.feriasFim))}>
              {editando ? '⏳ Salvando...' : '💾 Salvar Alterações'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => {setShowFormEditar(false); setUsuarioEditando(null)}} disabled={editando}>
              Cancelar
            </button>
          </div>
            </form>
          </div>
        </div>
      )}
      {/* TABELA DE USUÁRIOS */}
      <div className="usuarios-section">
        <div className="filtro-header">
          <h3>Usuários Cadastrados</h3>
          <input
            type="text"
            className="busca-usuario"
            placeholder="🔎 Buscar por nome ou matrícula..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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
          {usuariosFiltrados.length === 0 ? (
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
                  <th>Horário</th>
                  <th>Baia</th>
                  <th>Férias</th>
                  {podeEditar && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map(usuario => (
                  <tr key={usuario.uid} className={usuario.ativo === false ? 'usuario-inativo' : ''}>
                    <td className="nome-cell">
                      <strong>{usuario.nome}</strong>
                      {usuario.ativo === false && <span className="status-badge" style={{ marginLeft: 8 }}>Inativo</span>}
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
                    <td>{usuario.horarioEntrada || '-'}</td>
                    <td>{usuario.baia || '-'}</td>
                    <td>
                      {usuario.feriasInicio && usuario.feriasFim
                        ? `${new Date(usuario.feriasInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(usuario.feriasFim + 'T00:00:00').toLocaleDateString('pt-BR')}`
                        : '-'}
                    </td>
                    {podeEditar && (
                      <td>
                        <div className="acoes">
                          {usuario.role !== 'admin' && (
                            <>
                              {(usuario.uid !== userData?.uid || userData?.role === 'gestor' || userData?.role === 'lider') && (
                                <button
                                  className="btn-editar"
                                  onClick={() => abrirEditar(usuario)}
                                  title="Editar usuário"
                                  disabled={excluindoUid === usuario.uid}
                                >
                                  ✏️ Editar
                                </button>
                              )}
                              {usuario.uid !== userData?.uid && (
                                <button
                                  className={usuario.ativo ? 'btn-delete' : 'btn-success'}
                                  onClick={() => handleToggleAtivo(usuario)}
                                  title={usuario.ativo ? 'Desativar usuário' : 'Reativar usuário'}
                                  disabled={excluindoUid === usuario.uid}
                                >
                                  {excluindoUid === usuario.uid
                                    ? '⏳ Salvando...'
                                    : usuario.ativo ? '🚫 Desativar' : '✅ Reativar'}
                                </button>
                              )}
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
