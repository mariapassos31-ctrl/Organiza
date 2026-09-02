
import { useState, useEffect } from 'react'

import { auth } from '../services/firebase'
import '../styles/Escalas.css'

export default function Escalas() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filterEquipe, setFilterEquipe] = useState('todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [filterTecnico, setFilterTecnico] = useState('')
const [filterDataInicio, setFilterDataInicio] = useState('')
const [filterDataFim, setFilterDataFim] = useState('')
  const [anoInput, setAnoInput] = useState(currentMonth.getFullYear().toString())
  const [anoDropdownAberto, setAnoDropdownAberto] = useState(false)
const [filtrosAplicados, setFiltrosAplicados] = useState({
  tecnico: '',
  tipo: 'todos',
  dataInicio: '',
  dataFim: ''
})

  const TIPOS_ESCALA = [
    { id: 'presencial', label: '🏢 Presencial', cor: '#3498db' },
    { id: 'homeoffice', label: '🏠 Home Office', cor: '#2ecc71' },
    { id: 'sabado', label: '📅 Escala Sábado', cor: '#f39c12' },
    { id: 'sobreaviso', label: '🚨 Sobreaviso', cor: '#e74c3c' }
  ]

  const EQUIPES = [
    { id: 'suporte', label: '🎧 Suporte' },
    { id: 'infraestrutura', label: '🔧 Infraestrutura' },
    { id: 'sistemas', label: '💻 Sistemas' },
    { id: 'analista', label: '📊 Analista' }
  ]

  const [formData, setFormData] = useState({
    tipo: 'presencial',
    dataInicio: '',
    dataFim: '',
    tecnicos: [],
    equipe: 'suporte',
    descricao: '',
    status: 'ativa'
  })

  useEffect(() => {
    const currentUser = auth.currentUser
    setUser(currentUser)
    if (currentUser) {
      const usuariosData = JSON.parse(localStorage.getItem('usuarios') || '[]')
      const usuarioEncontrado = usuariosData.find(u => u.uid === currentUser.uid)
      setUserData(usuarioEncontrado)
      setUsuarios(usuariosData)
      if (usuarioEncontrado?.role === 'gestor') {
        setFilterEquipe(usuarioEncontrado.equipe)
      }
    }
    carregarEscalas()
  }, [])

  const aplicarFiltros = () => {
  setFiltrosAplicados({
    tecnico: filterTecnico,
    tipo: filterTipo,
    dataInicio: filterDataInicio,
    dataFim: filterDataFim
  })
  console.log('🔍 Filtros aplicados:', {
    tecnico: filterTecnico,
    tipo: filterTipo,
    dataInicio: filterDataInicio,
    dataFim: filterDataFim
  })
}

const limparFiltros = () => {
  setFilterTecnico('')
  setFilterTipo('todos')
  setFilterDataInicio('')
  setFilterDataFim('')
  setFiltrosAplicados({
    tecnico: '',
    tipo: 'todos',
    dataInicio: '',
    dataFim: ''
  })
}

  const carregarEscalas = () => {
    try {
      const dados = localStorage.getItem('escalas')
      if (dados) {
        setEscalas(JSON.parse(dados))
      }
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar escalas:', error)
      setLoading(false)
    }
  }

  const carregarTecnicosEquipe = (equipe) => {
    try {
      const usuariosData = JSON.parse(localStorage.getItem('usuarios') || '[]')
      return usuariosData.filter(u => u.equipe === equipe && (u.role === 'tecnico' || u.role === 'analista'))
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error)
      return []
    }
  }

  const podeEditar = userData?.role === 'admin' || userData?.role === 'gestor'

  const podeEditarEscala = (escala) => {
    if (userData?.role === 'admin') return true
    if (userData?.role === 'gestor' && escala.equipe === userData.equipe) return true
    return false
  }

  const escalasFiltradasPorEquipe = filterEquipe === 'todas' 
    ? escalas 
    : escalas.filter(e => e.equipe === filterEquipe)

 const escalasComBusca = escalasFiltradasPorEquipe.filter(e => {
  // Filtro por técnico (SÓ se aplicado)
  const matchTecnico = !filtrosAplicados.tecnico || 
    (e.tecnicos && e.tecnicos[0] === filtrosAplicados.tecnico)

  // Filtro por tipo (SÓ se aplicado)
  const matchTipo = filtrosAplicados.tipo === 'todos' || e.tipo === filtrosAplicados.tipo

  // Filtro por período de data (SÓ se aplicado)
  let matchData = true
  if (filtrosAplicados.dataInicio || filtrosAplicados.dataFim) {
    const dataInicio = filtrosAplicados.dataInicio ? new Date(filtrosAplicados.dataInicio) : null
    const dataFim = filtrosAplicados.dataFim ? new Date(filtrosAplicados.dataFim) : null
    
    const escalaInicio = new Date(e.dataInicio)
    
    if (dataInicio && dataFim) {
      matchData = escalaInicio >= dataInicio && escalaInicio <= dataFim
    } else if (dataInicio) {
      matchData = escalaInicio >= dataInicio
    } else if (dataFim) {
      matchData = escalaInicio <= dataFim
    }
  }

  return matchTecnico && matchTipo && matchData
})

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getEscalasDoMes = () => {
    const ano = currentMonth.getFullYear()
    const mes = currentMonth.getMonth()
    return escalasFiltradasPorEquipe.filter(escala => {
      const dataInicio = new Date(escala.dataInicio)
      const dataFim = new Date(escala.dataFim)
      dataFim.setDate(dataFim.getDate() + 1)
      return (
        (dataInicio.getFullYear() === ano && dataInicio.getMonth() === mes) ||
        (dataFim.getFullYear() === ano && dataFim.getMonth() === mes) ||
        (dataInicio < new Date(ano, mes, 1) && dataFim > new Date(ano, mes + 1, 0))
      )
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.dataInicio || !formData.dataFim || formData.tecnicos.length === 0) {
      alert('Preencha os campos obrigatórios!')
      return
    }
    try {
      let novasEscalas
      if (editingId) {
        novasEscalas = escalas.map(e => 
          e.id === editingId ? { ...formData, id: editingId } : e
        )
      } else {
        const novaEscala = {
          ...formData,
          id: Date.now().toString(),
          criadoPor: userData?.nome || user?.email,
          dataCriacao: new Date().toISOString()
        }
        novasEscalas = [...escalas, novaEscala]
      }
      localStorage.setItem('escalas', JSON.stringify(novasEscalas))
      setEscalas(novasEscalas)
      setFormData({
        tipo: 'presencial',
        dataInicio: '',
        dataFim: '',
        tecnicos: [],
        equipe: userData?.isGestor ? userData.equipe : 'suporte',
        descricao: '',
        status: 'ativa'
      })
      setEditingId(null)
      setShowForm(false)
      setModalOpen(false)
      alert(editingId ? 'Escala atualizada com sucesso!' : 'Escala criada com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar escala:', error)
      alert('Erro ao salvar escala')
    }
  }

  const handleEdit = (escala) => {
    if (!podeEditarEscala(escala)) {
      alert('Você não tem permissão para editar esta escala')
      return
    }
    setFormData(escala)
    setEditingId(escala.id)
    setModalOpen(true)
  }

  const handleDelete = (id) => {
    const escala = escalas.find(e => e.id === id)
    if (!escala) {
      alert('Escala não encontrada')
      return
    }
    if (!podeEditarEscala(escala)) {
      alert('Você não tem permissão para deletar esta escala')
      return
    }
    if (window.confirm('Tem certeza que deseja deletar esta escala?')) {
      try {
        const novasEscalas = escalas.filter(e => e.id !== id)
        localStorage.setItem('escalas', JSON.stringify(novasEscalas))
        setEscalas(novasEscalas)
        setModalOpen(false)
        alert('Escala deletada com sucesso!')
      } catch (error) {
        console.error('Erro ao deletar escala:', error)
        alert('Erro ao deletar escala. Tente novamente.')
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setModalOpen(false)
    setEditingId(null)
    setFormData({
      tipo: 'presencial',
      dataInicio: '',
      dataFim: '',
      tecnicos: [],
      equipe: userData?.isGestor ? userData.equipe : 'suporte',
      descricao: '',
      status: 'ativa'
    })
  }

  const getNomeTecnico = (uid) => {
    const tecnico = usuarios.find(u => u.uid === uid)
    return tecnico?.nome || 'Desconhecido'
  }

  const renderCalendario = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days = []
    const escalasDoMes = getEscalasDoMes()

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dataAtual = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const escalasDodia = escalasDoMes.filter(escala => {
        const dataInicio = new Date(escala.dataInicio)
        const dataFim = new Date(escala.dataFim)
        dataFim.setDate(dataFim.getDate() + 1)
        return dataAtual >= dataInicio && dataAtual < dataFim
      })

      days.push(
        <div key={day} className="calendar-day">
          <div className="day-number">{day}</div>
          <div className="day-escalas">
            {escalasDodia.map(escala => {
              const tipo = TIPOS_ESCALA.find(t => t.id === escala.tipo)
              const nomeTecnico = getNomeTecnico(escala.tecnicos[0])
              return (
                <div
                  key={escala.id}
                  className="escala-badge-beautiful"
                  style={{ backgroundColor: tipo?.cor }}
                  onClick={() => handleEdit(escala)}
                  title={`Clique para editar`}
                >
                  <span className="badge-tipo-beautiful">{tipo?.label.split(' ')[0]}</span>
                  <span className="badge-tecnico-beautiful">{nomeTecnico}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return days
  }

  if (loading) {
    return <div className="escalas-container"><p>Carregando escalas...</p></div>
  }

  return (
    <div className="escalas-container">
      <div className="escalas-header">
        <div>
          <h2>📅 Escalas</h2>
          <p className="subtitle">Gerenciamento de escalas por equipe</p>
        </div>
        {podeEditar && (
          <button className="btn-primary" onClick={() => {
            setShowForm(true)
            setModalOpen(false)
            setEditingId(null)
            setFormData({
              tipo: 'presencial',
              dataInicio: '',
              dataFim: '',
              tecnicos: [],
              equipe: userData?.isGestor ? userData.equipe : 'suporte',
              descricao: '',
              status: 'ativa'
            })
          }}>
            + Nova Escala
          </button>
        )}
      </div>

      <div className="escalas-filters">
        <label>Filtrar por Equipe:</label>
        <select value={filterEquipe} onChange={(e) => setFilterEquipe(e.target.value)}>
          <option value="todas">📊 Todas as Equipes</option>
          {EQUIPES.map(eq => (
            <option key={eq.id} value={eq.id}>{eq.label}</option>
          ))}
        </select>
      </div>

      <div className="escalas-legenda">
        {TIPOS_ESCALA.map(tipo => (
          <div key={tipo.id} className="legenda-item">
            <div className="legenda-cor" style={{ backgroundColor: tipo.cor }}></div>
            <span>{tipo.label}</span>
          </div>
        ))}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {modalOpen && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Escala</h3>
              <button className="modal-close" onClick={handleCancel}>✕</button>
            </div>
            <form className="escala-form-modal" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                  >
                    {TIPOS_ESCALA.map(tipo => (
                      <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Data Início *</label>
                  <input
                    type="date"
                    value={formData.dataInicio}
                    onChange={(e) => setFormData({...formData, dataInicio: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data Fim *</label>
                  <input
                    type="date"
                    value={formData.dataFim}
                    onChange={(e) => setFormData({...formData, dataFim: e.target.value})}
                    required
                  />
                </div>
                {userData?.role === 'admin' && (
                  <div className="form-group">
                    <label>Equipe *</label>
                    <select
                      value={formData.equipe}
                      onChange={(e) => {
                        const novaEquipe = e.target.value
                        setFormData({
                          ...formData, 
                          equipe: novaEquipe,
                          tecnicos: []
                        })
                      }}
                    >
                      {EQUIPES.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {podeEditar && (
                <div className="form-group">
                  <label>Técnico/Analista *</label>
                  <select
                    value={formData.tecnicos[0] || ''}
                    onChange={(e) => {
                      setFormData({...formData, tecnicos: e.target.value ? [e.target.value] : []})
                    }}
                    className="form-group-select"
                  >
                    <option value="">Selecione um técnico...</option>
                    {carregarTecnicosEquipe(userData?.role === 'admin' ? formData.equipe : userData?.equipe).map(tecnico => (
                      <option key={tecnico.uid} value={tecnico.uid}>
                        {tecnico.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Detalhes da escala..."
                />
              </div>
              <div className="form-actions-modal">
                <button type="submit" className="btn-success">
                  {editingId ? 'Atualizar' : 'Criar'}
                </button>
                {editingId && (
                  <button type="button" className="btn-delete-modal" onClick={() => handleDelete(editingId)}>
                    🗑️ Deletar
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORMULÁRIO PARA NOVA ESCALA */}
      {showForm && !modalOpen && podeEditar && (
        <form className="escala-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({...formData, tipo: e.target.value})}
              >
                {TIPOS_ESCALA.map(tipo => (
                  <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Data Início *</label>
              <input
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData({...formData, dataInicio: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Data Fim *</label>
              <input
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({...formData, dataFim: e.target.value})}
                required
              />
            </div>
            {userData?.role === 'admin' && (
              <div className="form-group">
                <label>Equipe *</label>
                <select
                  value={formData.equipe}
                  onChange={(e) => {
                    const novaEquipe = e.target.value
                    setFormData({
                      ...formData, 
                      equipe: novaEquipe,
                      tecnicos: []
                    })
                  }}
                >
                  {EQUIPES.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {podeEditar && (
            <div className="form-group">
              <label>Técnico/Analista *</label>
              <select
                value={formData.tecnicos[0] || ''}
                onChange={(e) => {
                  setFormData({...formData, tecnicos: e.target.value ? [e.target.value] : []})
                }}
                className="form-group-select"
              >
                <option value="">Selecione um técnico...</option>
                {carregarTecnicosEquipe(userData?.role === 'admin' ? formData.equipe : userData?.equipe).map(tecnico => (
                  <option key={tecnico.uid} value={tecnico.uid}>
                    {tecnico.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              placeholder="Detalhes da escala..."
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-success">
              Criar
            </button>
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* CALENDÁRIO */}
      <div className="calendario-container">
  <div className="calendario-header">
    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
      ← Anterior
    </button>
    
    <div className="calendario-selector">
      <select
        value={currentMonth.getMonth()}
        onChange={(e) => setCurrentMonth(new Date(currentMonth.getFullYear(), parseInt(e.target.value)))}
        className="mes-select"
      >
        <option value="0">Janeiro</option>
        <option value="1">Fevereiro</option>
        <option value="2">Março</option>
        <option value="3">Abril</option>
        <option value="4">Maio</option>
        <option value="5">Junho</option>
        <option value="6">Julho</option>
        <option value="7">Agosto</option>
        <option value="8">Setembro</option>
        <option value="9">Outubro</option>
        <option value="10">Novembro</option>
        <option value="11">Dezembro</option>
      </select>

   <input
  type="text"
  value={anoInput}
  onChange={(e) => {
    const valor = e.target.value
    setAnoInput(valor)
    if (valor === '') return
    const ano = parseInt(valor)
    if (!isNaN(ano) && valor.length <= 4) {
      setCurrentMonth(new Date(ano, currentMonth.getMonth()))
    }
  }}
  onBlur={() => {
    setAnoInput(currentMonth.getFullYear().toString())
  }}
  onFocus={(e) => e.target.select()}
  className="ano-input"
  placeholder="Ano"
  maxLength="4"
/>
    </div>

    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
      Próximo →
    </button>
  </div>
        <div className="calendario-weekdays">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        <div className="calendario-days">
          {renderCalendario()}
        </div>
      </div>

      {/* ESCALAS DETALHADAS COM BUSCA E FILTRO */}
      <div className="escalas-list">
        <div className="escalas-list-header">
          <h3>📋 Escalas Detalhadas</h3>
         <div className="escalas-list-controls">
  <select
    value={filterTecnico}
    onChange={(e) => setFilterTecnico(e.target.value)}
    className="filter-select"
  >
    <option value="">👥 Todos os Técnicos</option>
    {usuarios
      .filter(u => u.role === 'tecnico' || u.role === 'analista')
      .map(tecnico => (
        <option key={tecnico.uid} value={tecnico.uid}>
          {tecnico.nome}
        </option>
      ))}
  </select>

  <select
    value={filterTipo}
    onChange={(e) => setFilterTipo(e.target.value)}
    className="filter-select"
  >
    <option value="todos">📋 Todos os Tipos</option>
    {TIPOS_ESCALA.map(tipo => (
      <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
    ))}
  </select>

  <div className="filter-date-range">
    <div className="filter-date-group">
      <label>De:</label>
      <input
        type="date"
        value={filterDataInicio}
        onChange={(e) => setFilterDataInicio(e.target.value)}
        className="filter-date-input"
      />
    </div>
    <div className="filter-date-separator">→</div>
    <div className="filter-date-group">
      <label>Até:</label>
      <input
        type="date"
        value={filterDataFim}
        onChange={(e) => setFilterDataFim(e.target.value)}
        className="filter-date-input"
      />
    </div>
  </div>

  <button className="btn-filter-apply" onClick={aplicarFiltros}>
    🔍 Aplicar
  </button>

  <button className="btn-filter-clear" onClick={limparFiltros}>
    ✕ Limpar
  </button>
</div>
        </div>
        <div className="escalas-list-container">
          {escalasComBusca.length === 0 ? (
            <p className="empty-state">Nenhuma escala para exibir</p>
          ) : (
            escalasComBusca.map(escala => {
              const tipo = TIPOS_ESCALA.find(t => t.id === escala.tipo)
              const equipe = EQUIPES.find(e => e.id === escala.equipe)
              const podeEditarItem = podeEditarEscala(escala)
              return (
                <div key={escala.id} className="escala-card">
                  <div className="escala-card-header">
                    <div>
                      <h4>{escala.descricao || 'Escala sem descrição'}</h4>
                      <div className="escala-badges">
                        <span className="badge" style={{ backgroundColor: tipo?.cor }}>
                          {tipo?.label}
                        </span>
                        <span className="badge equipe">{equipe?.label}</span>
                        <span className={`badge status ${escala.status}`}>
                          {escala.status}
                        </span>
                      </div>
                    </div>
                    {podeEditarItem && (
                      <div className="escala-actions">
                        <button className="btn-edit" onClick={() => handleEdit(escala)}>
                          
                          ✏️ Editar
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(escala.id)}>
                          🗑️ Deletar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="escala-info">
                    <p>
                      <strong>📅 Período:</strong> {new Date(escala.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(escala.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                    {escala.tecnicos && escala.tecnicos.length > 0 && (
                      <div className="escala-tecnicos">
                        <strong>👥 Técnico:</strong>
                        <div className="tecnicos-badges">
                          {(Array.isArray(escala.tecnicos) ? escala.tecnicos : [escala.tecnicos]).map((tecnicoId, idx) => (
                            <span key={idx} className="tecnico-badge">
                              {getNomeTecnico(tecnicoId)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}