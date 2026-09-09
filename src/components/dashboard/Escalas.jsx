'use client'

import { useState, useEffect } from 'react'

import { useDashboardUser } from '../../context/DashboardUserContext'
import '../../styles/Escalas.css'

function addDiasStr(dataStr, delta) {
  const [y, m, d] = dataStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function diffDiasStr(inicioStr, fimStr) {
  const [y1, m1, d1] = inicioStr.split('-').map(Number)
  const [y2, m2, d2] = fimStr.split('-').map(Number)
  const t1 = new Date(y1, m1 - 1, d1).getTime()
  const t2 = new Date(y2, m2 - 1, d2).getTime()
  return Math.round((t2 - t1) / 86400000) + 1
}

export default function Escalas() {
  const { userData } = useDashboardUser()
  const [usuarios, setUsuarios] = useState([])
  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filterEquipe, setFilterEquipe] = useState('todas')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [selecionadasParaExcluir, setSelecionadasParaExcluir] = useState([])
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
    { id: 'projetos', label: '📁 Projetos' },
    { id: 'dev', label: '🧑‍💻 Dev' }
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

  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [autoForm, setAutoForm] = useState({
    equipe: 'suporte',
    tipo: 'presencial',
    dataInicio: '',
    dataFim: '',
    diasPorTecnico: 7,
    semFim: false,
    horizonteDias: 365,
  })
  const [autoTecnicosSelecionados, setAutoTecnicosSelecionados] = useState([])
  const [autoDiasTrabalho, setAutoDiasTrabalho] = useState([1, 2, 3, 4, 5])
  const [autoPercentualHome, setAutoPercentualHome] = useState(50)
  const [autoPreviewBlocos, setAutoPreviewBlocos] = useState([])
  const [autoPreviewErro, setAutoPreviewErro] = useState('')
  const [autoOverrides, setAutoOverrides] = useState({})
  const [autoRemovidos, setAutoRemovidos] = useState({})
  const [autoCarregandoPreview, setAutoCarregandoPreview] = useState(false)
  const [autoGerando, setAutoGerando] = useState(false)

  const DURACAO_PRESETS = {
    sabado: [{ label: '1 sábado', value: 1 }, { label: '2 sábados', value: 2 }, { label: '4 sábados', value: 4 }],
    padrao: [{ label: '1 dia', value: 1 }, { label: '1 semana', value: 7 }, { label: '15 dias', value: 15 }, { label: '1 mês', value: 30 }],
  }
  const HORIZONTE_PRESETS = [{ label: '3 meses', value: 90 }, { label: '6 meses', value: 180 }, { label: '1 ano', value: 365 }]
  const PERCENTUAL_PRESETS = [25, 50, 75]
  const DIAS_SEMANA = [
    { id: 1, label: 'Segunda' },
    { id: 2, label: 'Terça' },
    { id: 3, label: 'Quarta' },
    { id: 4, label: 'Quinta' },
    { id: 5, label: 'Sexta' },
    { id: 6, label: 'Sábado' },
    { id: 0, label: 'Domingo' },
  ]
  const TIPO_HIBRIDO = { id: 'hibrido', label: '🏢🏠 Presencial + Home Office', cor: '#8e44ad' }

  useEffect(() => {
  if (userData?.role === 'gestor') {
    setFormData(prev => ({ ...prev, equipe: userData.equipe }))
  }
  carregarUsuarios()
  carregarEscalas()
}, [userData])

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

  const carregarUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios')
      const dados = await response.json()
      setUsuarios(dados)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    }
  }

  const carregarEscalas = async () => {
    try {
      const response = await fetch('/api/escalas')
      const dados = await response.json()
      setEscalas(dados)
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar escalas:', error)
      setLoading(false)
    }
  }

  const carregarTecnicosEquipe = (equipe) => {
    return usuarios.filter(u => u.equipe === equipe && u.role !== 'admin' && u.role !== 'gestor')
  }

  // Tipos "reais" gravados no banco — usado ao editar uma escala já existente
  // (que pode ter sido criada como Presencial ou Home Office isolados pelo modo híbrido).
  const tiposDisponiveisParaEquipe = (equipe) => {
    return TIPOS_ESCALA.filter(t => t.id !== 'sabado' || equipe === 'suporte')
  }

  // Opções ao GERAR uma escala nova: Presencial e Home Office isolados saem
  // da lista porque já estão cobertos pelo modo híbrido (que os combina).
  const tiposGeracaoDisponiveis = (equipe) => {
    const base = TIPOS_ESCALA.filter(t =>
      (t.id === 'sabado' && equipe === 'suporte') || t.id === 'sobreaviso'
    )
    return [TIPO_HIBRIDO, ...base]
  }

  const carregarTecnicosAtivosEquipe = (equipe) => {
    return usuarios.filter(u => u.equipe === equipe && u.role !== 'admin' && u.role !== 'gestor' && u.ativo)
  }

  const fecharModalAuto = () => {
    setAutoModalOpen(false)
    setAutoPreviewBlocos([])
    setAutoPreviewErro('')
    setAutoOverrides({})
    setAutoRemovidos({})
  }

  const abrirModalAuto = () => {
    const equipeInicial = userData?.role === 'gestor' ? userData.equipe : 'suporte'
    setAutoForm({
      equipe: equipeInicial,
      tipo: 'hibrido',
      dataInicio: '',
      dataFim: '',
      diasPorTecnico: 7,
      semFim: false,
      horizonteDias: 365,
    })
    setAutoDiasTrabalho([1, 2, 3, 4, 5])
    setAutoPercentualHome(50)
    setAutoTecnicosSelecionados(carregarTecnicosAtivosEquipe(equipeInicial).map(t => t.uid))
    setAutoPreviewBlocos([])
    setAutoPreviewErro('')
    setAutoOverrides({})
    setAutoRemovidos({})
    setAutoModalOpen(true)
  }

  const mudarEquipeAuto = (novaEquipe) => {
    setAutoForm(prev => ({
      ...prev,
      equipe: novaEquipe,
      tipo: prev.tipo === 'sabado' && novaEquipe !== 'suporte' ? 'hibrido' : prev.tipo,
    }))
    setAutoTecnicosSelecionados(carregarTecnicosAtivosEquipe(novaEquipe).map(t => t.uid))
  }

  const mudarTipoAuto = (novoTipo) => {
    setAutoForm(prev => ({ ...prev, tipo: novoTipo, diasPorTecnico: novoTipo === 'sabado' ? 1 : 7 }))
  }

  const toggleTecnicoAuto = (uid) => {
    setAutoTecnicosSelecionados(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    )
  }

  const selecionarTodosTecnicosAuto = () => {
    setAutoTecnicosSelecionados(carregarTecnicosAtivosEquipe(autoForm.equipe).map(t => t.uid))
  }

  const toggleDiaTrabalho = (diaId) => {
    setAutoDiasTrabalho(prev =>
      prev.includes(diaId) ? prev.filter(d => d !== diaId) : [...prev, diaId]
    )
  }

  // Monta o payload de configuração sem alertar nada — usado pela prévia ao
  // vivo, que só dispara quando os campos já fazem sentido.
  const construirPayloadAuto = () => {
    if (!autoForm.dataInicio || autoTecnicosSelecionados.length === 0) return null

    let dataFimEfetiva = autoForm.dataFim
    if (autoForm.semFim) {
      const horizonte = Number(autoForm.horizonteDias)
      if (!Number.isInteger(horizonte) || horizonte < 1) return null
      dataFimEfetiva = addDiasStr(autoForm.dataInicio, horizonte - 1)
    } else {
      if (!autoForm.dataFim || autoForm.dataFim < autoForm.dataInicio) return null
    }

    if (autoForm.tipo === 'hibrido') {
      if (autoDiasTrabalho.length === 0) return null
      return {
        tipo: 'hibrido',
        equipe: autoForm.equipe,
        dataInicio: autoForm.dataInicio,
        dataFim: dataFimEfetiva,
        tecnicoUids: autoTecnicosSelecionados,
        diasTrabalho: autoDiasTrabalho,
        percentualHomeOffice: Number(autoPercentualHome),
      }
    }

    return {
      tipo: autoForm.tipo,
      equipe: autoForm.equipe,
      dataInicio: autoForm.dataInicio,
      dataFim: dataFimEfetiva,
      diasPorTecnico: Number(autoForm.diasPorTecnico),
      tecnicoUids: autoTecnicosSelecionados,
    }
  }

  // Prévia ao vivo: recalcula sozinha (com um pequeno atraso) toda vez que
  // a configuração muda, sem precisar de um botão "Pré-visualizar".
  useEffect(() => {
    if (!autoModalOpen) return
    const payload = construirPayloadAuto()
    if (!payload) {
      setAutoPreviewBlocos([])
      setAutoPreviewErro('')
      return
    }
    const handle = setTimeout(async () => {
      setAutoCarregandoPreview(true)
      try {
        const response = await fetch('/api/escalas/auto/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          setAutoPreviewBlocos([])
          setAutoPreviewErro(data.error || 'Não foi possível calcular a prévia')
        } else {
          setAutoPreviewBlocos(data.blocos)
          setAutoPreviewErro('')
          setAutoOverrides({})
          setAutoRemovidos({})
        }
      } catch {
        setAutoPreviewErro('Não foi possível calcular a prévia')
      } finally {
        setAutoCarregandoPreview(false)
      }
    }, 500)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoModalOpen, autoForm, autoTecnicosSelecionados, autoDiasTrabalho, autoPercentualHome])

  const nomeTecnicoAuto = (uid) => carregarTecnicosAtivosEquipe(autoForm.equipe).find(t => t.uid === uid)?.nome || '?'

  const blocosEfetivosAuto = autoPreviewBlocos
    .map((b, i) => ({
      ...b,
      tecnicoUid: autoOverrides[i] || b.tecnicoUid,
      tecnicoNome: autoOverrides[i] ? nomeTecnicoAuto(autoOverrides[i]) : b.tecnicoNome,
    }))
    .filter((_, i) => !autoRemovidos[i])

  const confirmarGeracaoAuto = async () => {
    if (blocosEfetivosAuto.length === 0) return
    setAutoGerando(true)
    try {
      const response = await fetch('/api/escalas/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipe: autoForm.equipe,
          blocosManuais: blocosEfetivosAuto.map(b => ({
            dataInicio: b.dataInicio,
            dataFim: b.dataFim,
            tecnicoUid: b.tecnicoUid,
            tipo: b.tipo,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao gerar escalas')
      }
      await carregarEscalas()
      fecharModalAuto()
      alert(`${data.criadas} escala(s) gerada(s) com sucesso!`)
    } catch (error) {
      alert(error.message)
    } finally {
      setAutoGerando(false)
    }
  }

  const podeEditar = userData?.role === 'admin' || userData?.role === 'gestor'

  const podeEditarEscala = (escala) => {
    if (userData?.role === 'admin') return true
    if (userData?.role === 'gestor' && escala.equipe === userData.equipe) return true
    return false
  }

  const canEditCurrent = modalOpen && editingId ? podeEditarEscala(formData) : false

  const resumoPorTecnicoAuto = {}
  for (const b of blocosEfetivosAuto) {
    const dias = diffDiasStr(b.dataInicio, b.dataFim)
    if (!resumoPorTecnicoAuto[b.tecnicoNome]) resumoPorTecnicoAuto[b.tecnicoNome] = {}
    resumoPorTecnicoAuto[b.tecnicoNome][b.tipo] = (resumoPorTecnicoAuto[b.tecnicoNome][b.tipo] || 0) + dias
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

  const escalasEditaveisVisiveis = escalasComBusca.filter(e => podeEditarEscala(e))
  const todasVisiveisSelecionadas = escalasEditaveisVisiveis.length > 0 &&
    escalasEditaveisVisiveis.every(e => selecionadasParaExcluir.includes(e.id))

  const toggleSelecionarTodasVisiveis = () => {
    if (todasVisiveisSelecionadas) {
      const idsVisiveis = new Set(escalasEditaveisVisiveis.map(e => e.id))
      setSelecionadasParaExcluir(prev => prev.filter(id => !idsVisiveis.has(id)))
    } else {
      setSelecionadasParaExcluir(prev => [...new Set([...prev, ...escalasEditaveisVisiveis.map(e => e.id)])])
    }
  }

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.dataInicio || !formData.dataFim || formData.tecnicos.length === 0) {
      alert('Preencha os campos obrigatórios!')
      return
    }
    if (!podeEditarEscala(formData)) {
      alert('Você não tem permissão para editar esta escala')
      return
    }
    try {
      const payload = {
        tipo: formData.tipo,
        dataInicio: formData.dataInicio,
        dataFim: formData.dataFim,
        tecnicos: formData.tecnicos,
        equipe: userData?.role === 'gestor' ? userData.equipe : formData.equipe,
        descricao: formData.descricao,
        status: formData.status,
      }

      const response = await fetch(`/api/escalas/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar escala')
      }

      await carregarEscalas()
      setEditingId(null)
      setModalOpen(false)
      alert('Escala atualizada com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar escala:', error)
      alert('Erro ao salvar escala')
    }
  }

  const handleEdit = (escala) => {
    setFormData(escala)
    setEditingId(escala.id)
    setModalOpen(true)
  }

  const toggleSelecaoEscala = (id) => {
    setSelecionadasParaExcluir(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleExcluirSelecionadas = async () => {
    if (selecionadasParaExcluir.length === 0) return
    if (!window.confirm(`Tem certeza que deseja excluir ${selecionadasParaExcluir.length} escala(s)? Essa ação não pode ser desfeita.`)) {
      return
    }
    const resultados = await Promise.all(
      selecionadasParaExcluir.map(id =>
        fetch(`/api/escalas/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.ok)
      )
    )
    const falhas = resultados.filter(ok => !ok).length
    await carregarEscalas()
    setSelecionadasParaExcluir([])
    alert(falhas > 0
      ? `${resultados.length - falhas} escala(s) excluída(s). ${falhas} falharam (permissão ou já removidas).`
      : `${resultados.length} escala(s) excluída(s) com sucesso!`)
  }

  const handleDelete = async (id) => {
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
        const response = await fetch(`/api/escalas/${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Falha ao deletar escala')
        }
        await carregarEscalas()
        setModalOpen(false)
        alert('Escala deletada com sucesso!')
      } catch (error) {
        console.error('Erro ao deletar escala:', error)
        alert('Erro ao deletar escala. Tente novamente.')
      }
    }
  }

  const handleCancel = () => {
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
                  title={podeEditarEscala(escala) ? 'Clique para editar' : 'Clique para ver detalhes'}
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
          <div className="escalas-header-actions">
            <button className="btn-primary" onClick={abrirModalAuto}>
              🪄 Nova Escala
            </button>
          </div>
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
              <h3>{canEditCurrent ? 'Editar Escala' : 'Detalhes da Escala'}</h3>
              <button className="modal-close" onClick={handleCancel}>✕</button>
            </div>
            <form className="escala-form-modal" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                    disabled={!canEditCurrent}
                  >
                    {tiposDisponiveisParaEquipe(formData.equipe).map(tipo => (
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
                    disabled={!canEditCurrent}
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
                    disabled={!canEditCurrent}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Equipe *</label>
                  <select
                    value={formData.equipe}
                    onChange={(e) => {
                      const novaEquipe = e.target.value
                      setFormData({
                        ...formData,
                        equipe: novaEquipe,
                        tipo: formData.tipo === 'sabado' && novaEquipe !== 'suporte' ? 'presencial' : formData.tipo,
                        tecnicos: []
                      })
                    }}
                    disabled={!canEditCurrent || userData?.role !== 'admin'}
                  >
                    {canEditCurrent && userData?.role === 'admin' ? (
                      EQUIPES.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.label}</option>
                      ))
                    ) : (
                      <option value={formData.equipe}>
                        {EQUIPES.find(eq => eq.id === formData.equipe)?.label || formData.equipe}
                      </option>
                    )}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Técnico/Analista *</label>
                <select
                  value={formData.tecnicos[0] || ''}
                  onChange={(e) => {
                    setFormData({...formData, tecnicos: e.target.value ? [e.target.value] : []})
                  }}
                  className="form-group-select"
                  disabled={!canEditCurrent}
                >
                  {canEditCurrent ? (
                    <>
                      <option value="">Selecione um técnico...</option>
                      {carregarTecnicosEquipe(userData?.role === 'admin' ? formData.equipe : userData?.equipe).map(tecnico => (
                        <option key={tecnico.uid} value={tecnico.uid}>
                          {tecnico.nome}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value={formData.tecnicos[0] || ''}>
                      {getNomeTecnico(formData.tecnicos[0])}
                    </option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Detalhes da escala..."
                  disabled={!canEditCurrent}
                />
              </div>
              <div className="form-actions-modal">
                {canEditCurrent && (
                  <button type="submit" className="btn-success">
                    Atualizar
                  </button>
                )}
                {canEditCurrent && (
                  <button type="button" className="btn-delete-modal" onClick={() => handleDelete(editingId)}>
                    🗑️ Deletar
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  {canEditCurrent ? 'Cancelar' : 'Fechar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA ESCALA */}
      {autoModalOpen && (
        <div className="modal-overlay" onClick={fecharModalAuto}>
          <div className="modal-content auto-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🪄 Nova Escala</h3>
              <button className="modal-close" onClick={fecharModalAuto}>✕</button>
            </div>

            <div className="auto-form">
              <div className="auto-secao">
                <label className="auto-secao-titulo">O que você quer escalar?</label>
                <div className="auto-chip-row">
                  {tiposGeracaoDisponiveis(autoForm.equipe).map(tipo => (
                    <button
                      type="button"
                      key={tipo.id}
                      className={`auto-chip ${autoForm.tipo === tipo.id ? 'ativo' : ''}`}
                      style={autoForm.tipo === tipo.id ? { background: tipo.cor, borderColor: tipo.cor } : {}}
                      onClick={() => mudarTipoAuto(tipo.id)}
                    >
                      {tipo.label}
                    </button>
                  ))}
                </div>
                {autoForm.tipo === 'hibrido' && (
                  <small className="auto-campo-ajuda">
                    Todo dia, a equipe é dividida entre Presencial e Home Office na proporção definida, revezando quem fica em cada grupo — ao final de um ciclo completo, todo mundo teve a mesma quantidade de dias de cada tipo.
                  </small>
                )}
              </div>

              {userData?.role === 'admin' && (
                <div className="auto-secao">
                  <label className="auto-secao-titulo">Equipe</label>
                  <div className="auto-chip-row">
                    {EQUIPES.map(eq => (
                      <button
                        type="button"
                        key={eq.id}
                        className={`auto-chip ${autoForm.equipe === eq.id ? 'ativo' : ''}`}
                        onClick={() => mudarEquipeAuto(eq.id)}
                      >
                        {eq.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="auto-secao">
                <div className="auto-secao-header">
                  <label className="auto-secao-titulo">Técnicos participantes</label>
                  <button type="button" className="auto-link" onClick={selecionarTodosTecnicosAuto}>
                    Selecionar todos
                  </button>
                </div>
                <div className="auto-chip-row">
                  {carregarTecnicosAtivosEquipe(autoForm.equipe).length === 0 ? (
                    <p className="empty-state">Nenhum técnico ativo nessa equipe</p>
                  ) : (
                    carregarTecnicosAtivosEquipe(autoForm.equipe).map(tecnico => (
                      <button
                        type="button"
                        key={tecnico.uid}
                        className={`auto-chip auto-chip-tecnico ${autoTecnicosSelecionados.includes(tecnico.uid) ? 'ativo' : ''}`}
                        onClick={() => toggleTecnicoAuto(tecnico.uid)}
                      >
                        {autoTecnicosSelecionados.includes(tecnico.uid) ? '✓ ' : ''}{tecnico.nome}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {autoForm.tipo === 'hibrido' && (
                <>
                  <div className="auto-secao">
                    <label className="auto-secao-titulo">Dias de trabalho</label>
                    <div className="auto-chip-row">
                      {DIAS_SEMANA.map(dia => (
                        <button
                          type="button"
                          key={dia.id}
                          className={`auto-chip ${autoDiasTrabalho.includes(dia.id) ? 'ativo' : ''}`}
                          onClick={() => toggleDiaTrabalho(dia.id)}
                        >
                          {dia.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="auto-secao">
                    <label className="auto-secao-titulo">Porcentagem em Home Office</label>
                    <div className="auto-chip-row">
                      {PERCENTUAL_PRESETS.map(p => (
                        <button
                          type="button"
                          key={p}
                          className={`auto-chip ${autoPercentualHome === p ? 'ativo' : ''}`}
                          onClick={() => setAutoPercentualHome(p)}
                        >
                          {p}%
                        </button>
                      ))}
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={autoPercentualHome}
                        onChange={(e) => setAutoPercentualHome(e.target.value)}
                        className="auto-dias-input"
                        title="Porcentagem personalizada"
                      />
                    </div>
                    {autoTecnicosSelecionados.length > 0 && (
                      <small className="auto-campo-ajuda">
                        Todo dia de trabalho, {Math.round((autoTecnicosSelecionados.length * Number(autoPercentualHome || 0)) / 100)} de {autoTecnicosSelecionados.length} técnico(s) ficam em home office; os demais ficam presencial.
                      </small>
                    )}
                  </div>
                </>
              )}

              <div className="auto-secao">
                <label className="auto-secao-titulo">Data de início</label>
                <input
                  type="date"
                  value={autoForm.dataInicio}
                  onChange={(e) => setAutoForm({ ...autoForm, dataInicio: e.target.value })}
                  className="auto-date-input"
                />
              </div>

              {autoForm.tipo !== 'hibrido' && autoTecnicosSelecionados.length > 1 && (
                <div className="auto-secao">
                  <label className="auto-secao-titulo">
                    {autoForm.tipo === 'sabado' ? 'Sábados seguidos por técnico' : 'Duração do turno de cada técnico'}
                  </label>
                  <div className="auto-chip-row">
                    {(autoForm.tipo === 'sabado' ? DURACAO_PRESETS.sabado : DURACAO_PRESETS.padrao).map(p => (
                      <button
                        type="button"
                        key={p.value}
                        className={`auto-chip ${Number(autoForm.diasPorTecnico) === p.value ? 'ativo' : ''}`}
                        onClick={() => setAutoForm({ ...autoForm, diasPorTecnico: p.value })}
                      >
                        {p.label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      value={autoForm.diasPorTecnico}
                      onChange={(e) => setAutoForm({ ...autoForm, diasPorTecnico: e.target.value })}
                      className="auto-dias-input"
                      title="Valor personalizado"
                    />
                  </div>
                  {autoForm.tipo === 'sabado' && (
                    <small className="auto-campo-ajuda">Só os sábados do período viram escala; os demais dias são ignorados.</small>
                  )}
                </div>
              )}
              {autoForm.tipo !== 'hibrido' && autoTecnicosSelecionados.length === 1 && autoForm.tipo === 'sabado' && (
                <p className="auto-explicacao">Só 1 técnico selecionado: todos os sábados do período ficam com ele(a).</p>
              )}
              {autoForm.tipo !== 'hibrido' && autoTecnicosSelecionados.length === 1 && autoForm.tipo !== 'sabado' && (
                <p className="auto-explicacao">Só 1 técnico selecionado: o período inteiro fica com ele(a), numa única escala.</p>
              )}

              <div className="auto-secao">
                <label className="auto-secao-titulo">Até quando gerar</label>
                <div className="auto-chip-row">
                  <button
                    type="button"
                    className={`auto-chip ${!autoForm.semFim ? 'ativo' : ''}`}
                    onClick={() => setAutoForm({ ...autoForm, semFim: false })}
                  >
                    Data de fim definida
                  </button>
                  <button
                    type="button"
                    className={`auto-chip ${autoForm.semFim ? 'ativo' : ''}`}
                    onClick={() => setAutoForm({ ...autoForm, semFim: true })}
                  >
                    Sem data de fim
                  </button>
                </div>
                {autoForm.semFim ? (
                  <>
                    <div className="auto-chip-row">
                      {HORIZONTE_PRESETS.map(p => (
                        <button
                          type="button"
                          key={p.value}
                          className={`auto-chip ${Number(autoForm.horizonteDias) === p.value ? 'ativo' : ''}`}
                          onClick={() => setAutoForm({ ...autoForm, horizonteDias: p.value })}
                        >
                          {p.label}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        value={autoForm.horizonteDias}
                        onChange={(e) => setAutoForm({ ...autoForm, horizonteDias: e.target.value })}
                        className="auto-dias-input"
                        title="Dias personalizados"
                      />
                    </div>
                    <small className="auto-campo-ajuda">
                      Gera escalas até essa data à frente. Quando estiver acabando, gere de novo a partir dali para continuar.
                    </small>
                  </>
                ) : (
                  <input
                    type="date"
                    value={autoForm.dataFim}
                    onChange={(e) => setAutoForm({ ...autoForm, dataFim: e.target.value })}
                    className="auto-date-input"
                  />
                )}
              </div>

              {/* PRÉVIA AO VIVO */}
              <div className="auto-secao auto-preview-secao">
                <label className="auto-secao-titulo">
                  Prévia {autoCarregandoPreview && <span className="auto-preview-carregando">atualizando...</span>}
                </label>

                {autoPreviewErro && <p className="auto-preview-erro">⚠️ {autoPreviewErro}</p>}

                {!autoPreviewErro && blocosEfetivosAuto.length === 0 && (
                  <p className="empty-state">Preencha os campos acima para ver a prévia.</p>
                )}

                {blocosEfetivosAuto.length > 0 && (
                  <>
                    <p className="auto-explicacao">
                      {blocosEfetivosAuto.length} escala(s) serão criadas. Dá pra trocar o técnico de cada uma ou remover antes de confirmar.
                    </p>

                    <div className="auto-resumo-tabela">
                      {Object.entries(resumoPorTecnicoAuto).map(([nome, contagem]) => (
                        <div key={nome} className="auto-resumo-linha">
                          <span className="auto-resumo-nome">{nome}</span>
                          {Object.entries(contagem).map(([tipoId, dias]) => (
                            <span key={tipoId} className="auto-resumo-valor">
                              {tipoId === 'presencial' ? '🏢' : tipoId === 'homeoffice' ? '🏠' : tipoId === 'sabado' ? '📅' : '🚨'} {dias}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div className="auto-preview-lista">
                      {autoPreviewBlocos.map((b, i) => {
                        if (autoRemovidos[i]) return null
                        const tecnicoAtualUid = autoOverrides[i] || b.tecnicoUid
                        return (
                          <div key={i} className="auto-preview-item">
                            <span className="auto-preview-tipo">
                              {b.tipo === 'presencial' ? '🏢' : b.tipo === 'homeoffice' ? '🏠' : b.tipo === 'sabado' ? '📅' : '🚨'}
                            </span>
                            <span className="auto-preview-periodo">
                              {new Date(b.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                              {b.dataInicio !== b.dataFim && ` a ${new Date(b.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                            </span>
                            <span className="auto-preview-seta">→</span>
                            <select
                              className="auto-preview-tecnico-select"
                              value={tecnicoAtualUid}
                              onChange={(e) => setAutoOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                            >
                              {carregarTecnicosAtivosEquipe(autoForm.equipe).map(t => (
                                <option key={t.uid} value={t.uid}>{t.nome}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="auto-preview-remover"
                              title="Remover esta escala"
                              onClick={() => setAutoRemovidos(prev => ({ ...prev, [i]: true }))}
                            >
                              ✕
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="form-actions-modal">
                <button type="button" className="btn-success" disabled={autoGerando || blocosEfetivosAuto.length === 0} onClick={confirmarGeracaoAuto}>
                  {autoGerando
                    ? 'Gerando...'
                    : blocosEfetivosAuto.length > 0
                    ? `✅ Gerar ${blocosEfetivosAuto.length} Escala(s)`
                    : '✅ Gerar Escalas'}
                </button>
                <button type="button" className="btn-secondary" onClick={fecharModalAuto}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
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
      .filter(u => u.role !== 'admin' && u.role !== 'gestor')
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

        {escalasEditaveisVisiveis.length > 0 && (
          <div className="escalas-bulk-bar">
            <label className="escalas-bulk-checkbox">
              <input
                type="checkbox"
                checked={todasVisiveisSelecionadas}
                onChange={toggleSelecionarTodasVisiveis}
              />
              Selecionar todas as visíveis ({escalasEditaveisVisiveis.length})
            </label>
            <button
              className="btn-delete"
              disabled={selecionadasParaExcluir.length === 0}
              onClick={handleExcluirSelecionadas}
            >
              🗑️ Excluir Selecionadas ({selecionadasParaExcluir.length})
            </button>
          </div>
        )}

        <div className="escalas-list-container">
          {escalasComBusca.length === 0 ? (
            <p className="empty-state">Nenhuma escala para exibir</p>
          ) : (
            escalasComBusca.map(escala => {
              const tipo = TIPOS_ESCALA.find(t => t.id === escala.tipo)
              const equipe = EQUIPES.find(e => e.id === escala.equipe)
              const podeEditarItem = podeEditarEscala(escala)
              return (
                <div key={escala.id} className={`escala-card ${selecionadasParaExcluir.includes(escala.id) ? 'selecionada' : ''}`}>
                  <div className="escala-card-header">
                    <div className="escala-card-titulo">
                      {podeEditarItem && (
                        <input
                          type="checkbox"
                          className="escala-card-checkbox"
                          checked={selecionadasParaExcluir.includes(escala.id)}
                          onChange={() => toggleSelecaoEscala(escala.id)}
                        />
                      )}
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
                    </div>
                    <div className="escala-actions">
                      {podeEditarItem ? (
                        <>
                          <button className="btn-edit" onClick={() => handleEdit(escala)}>
                            ✏️ Editar
                          </button>
                          <button className="btn-delete" onClick={() => handleDelete(escala.id)}>
                            🗑️ Deletar
                          </button>
                        </>
                      ) : (
                        <button className="btn-edit" onClick={() => handleEdit(escala)}>
                          👁️ Ver
                        </button>
                      )}
                    </div>
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