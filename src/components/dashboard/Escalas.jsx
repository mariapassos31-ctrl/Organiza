'use client'

import { useState, useEffect } from 'react'

import { useDashboardUser } from '../../context/DashboardUserContext'
import { EQUIPES, nuncaEhEscalado } from '../../lib/equipesConfig'
import { TIPOS_ESCALA, ordenarSobreavisoPrimeiro } from '../../lib/escalasConstants'
import CalendarioEscalas from './escalas/CalendarioEscalas'
import DiaDetalhadoModal from './escalas/DiaDetalhadoModal'
import EscalaEditModal from './escalas/EscalaEditModal'
import GeradorEscalaModal from './escalas/GeradorEscalaModal'
import EscalasListaDetalhada from './escalas/EscalasListaDetalhada'
import '../../styles/Escalas.css'

export default function Escalas() {
  const { userData } = useDashboardUser()
  const [usuarios, setUsuarios] = useState([])
  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filterEquipe, setFilterEquipe] = useState('todas')
  const [filterTecnico, setFilterTecnico] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [diaDetalhado, setDiaDetalhado] = useState(null)
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [mostrarListaDetalhada, setMostrarListaDetalhada] = useState(false)
  const [mostrarFormTroca, setMostrarFormTroca] = useState(false)
  const [tipoTroca, setTipoTroca] = useState('completa')
  const [diaTroca, setDiaTroca] = useState('')
  const [destinoTroca, setDestinoTroca] = useState('')
  const [enviandoTroca, setEnviandoTroca] = useState(false)
  const [escalaOferecidaId, setEscalaOferecidaId] = useState('')
  const [baiasPerfil, setBaiasPerfil] = useState({})
  const [salaCompartilhadaBaias, setSalaCompartilhadaBaias] = useState({})
  const [laboratorioConfig, setLaboratorioConfig] = useState({ responsavelUid: null, backupUid: null })

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
    if (userData?.role === 'gestor' || userData?.role === 'lider') {
      setFormData(prev => ({ ...prev, equipe: userData.equipe }))
    }
    carregarUsuarios()
    carregarEscalas()
    carregarBaiasPerfil()
    carregarLaboratorioConfig()
  }, [userData])

  // O mapa do dia do Suporte só entende { [baia]: perfilId } (sala de uma
  // equipe só); o da Sala Compartilhada entende { [baia]: {equipe, especialidade} }
  // (2+ equipes) — os dois já vêm prontos nesse formato da API de Salas.
  const carregarBaiasPerfil = async () => {
    try {
      const response = await fetch('/api/salas')
      if (!response.ok) return
      const dados = await response.json()
      const salaSuporte = (dados.salas || []).find(s => s.modoReserva === 'perfil' && s.equipes.includes('suporte'))
      const mapa = {}
      for (const [baia, valor] of Object.entries(salaSuporte?.baias || {})) {
        if (valor?.perfil) mapa[baia] = valor.perfil
      }
      setBaiasPerfil(mapa)

      const salaCompartilhada = (dados.salas || []).find(s => s.modoReserva === 'equipe')
      setSalaCompartilhadaBaias(salaCompartilhada?.baias || {})
    } catch (error) {
      console.error('Erro ao carregar configuração de baias:', error)
    }
  }

  const carregarLaboratorioConfig = async () => {
    try {
      const response = await fetch('/api/laboratorio-config?equipe=suporte')
      if (!response.ok) return
      const dados = await response.json()
      setLaboratorioConfig({ responsavelUid: dados.responsavelUid || null, backupUid: dados.backupUid || null })
    } catch (error) {
      console.error('Erro ao carregar configuração do Laboratório:', error)
    }
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
    return usuarios.filter(u => u.equipe === equipe && u.role !== 'admin' && u.role !== 'gestor' && u.baia !== '0')
  }

  const podeEditar = userData?.role === 'admin' || userData?.role === 'gestor' || userData?.role === 'lider'

  const podeEditarEscala = (escala) => {
    if (userData?.role === 'admin') return true
    if ((userData?.role === 'gestor' || userData?.role === 'lider') && escala.equipe === userData.equipe) {
      // Líder participa do rodízio normal — não edita a própria escala
      // diretamente, só pode solicitar troca com um colega (igual técnico).
      if (userData.role === 'lider' && (escala.tecnicos || []).includes(userData.uid)) return false
      return true
    }
    return false
  }

  const canEditCurrent = modalOpen && editingId ? podeEditarEscala(formData) : false

  const souTecnico = userData?.role !== 'admin' && userData?.role !== 'gestor'
  const ehMinhaEscala = modalOpen && (formData.tecnicos || []).includes(userData?.uid)
  const podeSolicitarTroca = souTecnico && ehMinhaEscala && !canEditCurrent

  const colegasParaTroca = usuarios.filter(u =>
    u.equipe === userData?.equipe &&
    u.role !== 'admin' && u.role !== 'gestor' &&
    u.uid !== userData?.uid &&
    u.ativo
  )

  // Escala de um colega (não minha, não editável por mim) — dá pra propor
  // trocar uma escala minha por essa, em vez de só entregar a minha.
  const donoDaEscalaAberta = usuarios.find(u => u.uid === formData.tecnicos?.[0])
  const podePropinTroca = Boolean(
    souTecnico && modalOpen && !ehMinhaEscala && !canEditCurrent &&
    donoDaEscalaAberta &&
    colegasParaTroca.some(c => c.uid === donoDaEscalaAberta.uid)
  )

  const minhasEscalasParaOferecer = escalas
    .filter(e => (e.tecnicos || []).includes(userData?.uid) && e.id !== editingId)
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))

  const nomeTipoEscala = (tipoId) => TIPOS_ESCALA.find(t => t.id === tipoId)?.label || tipoId

  const enviarPropostaTroca = async () => {
    if (!escalaOferecidaId) {
      alert('Selecione qual das suas escalas você quer oferecer em troca')
      return
    }
    if (tipoTroca === 'dia' && !diaTroca) {
      alert('Selecione o dia que deseja oferecer')
      return
    }
    setEnviandoTroca(true)
    try {
      const response = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalaId: escalaOferecidaId,
          tecnicoDestinoUid: donoDaEscalaAberta?.uid,
          escalaSolicitadaId: editingId,
          dia: tipoTroca === 'dia' ? diaTroca : undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao propor a troca')
      }
      alert('Proposta de troca enviada! Acompanhe em "Trocas".')
      handleCancel()
    } catch (error) {
      alert(error.message)
    } finally {
      setEnviandoTroca(false)
    }
  }

  const enviarSolicitacaoTroca = async () => {
    if (!destinoTroca) {
      alert('Selecione o colega com quem deseja trocar')
      return
    }
    if (tipoTroca === 'dia' && !diaTroca) {
      alert('Selecione o dia que deseja trocar')
      return
    }
    setEnviandoTroca(true)
    try {
      const response = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalaId: editingId,
          tecnicoDestinoUid: destinoTroca,
          dia: tipoTroca === 'dia' ? diaTroca : undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao solicitar a troca')
      }
      alert('Solicitação de troca enviada! Acompanhe em "Trocas".')
      handleCancel()
    } catch (error) {
      alert(error.message)
    } finally {
      setEnviandoTroca(false)
    }
  }

  const escalasFiltradasPorEquipe = (filterEquipe === 'todas'
    ? escalas
    : escalas.filter(e => e.equipe === filterEquipe)
  ).filter(e => filterTecnico === 'todos' || e.tecnicos.includes(filterTecnico))

  const tecnicosParaFiltro = usuarios
    .filter(u =>
      !nuncaEhEscalado(u.role) &&
      (filterEquipe === 'todas' || u.equipe === filterEquipe)
    )
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const escalasDoDia = (data) => ordenarSobreavisoPrimeiro(escalasFiltradasPorEquipe.filter(escala => {
    const dataInicio = new Date(escala.dataInicio)
    const dataFim = new Date(escala.dataFim)
    dataFim.setDate(dataFim.getDate() + 1)
    return data >= dataInicio && data < dataFim
  }))

  // Setinhas do modal do dia: troca a data e recalcula quem está escalado,
  // sem precisar fechar e clicar de novo no calendário.
  const navegarDiaDetalhado = (delta) => {
    setDiaDetalhado((atual) => {
      if (!atual) return atual
      const novaData = new Date(atual.data)
      novaData.setDate(novaData.getDate() + delta)
      return { data: novaData, escalas: escalasDoDia(novaData) }
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
        equipe: (userData?.role === 'gestor' || userData?.role === 'lider') ? userData.equipe : formData.equipe,
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
    setMostrarFormTroca(false)
    setTipoTroca('completa')
    setDiaTroca('')
    setDestinoTroca('')
    setEscalaOferecidaId('')
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
    setMostrarFormTroca(false)
  }

  const getNomeTecnico = (uid) => {
    const tecnico = usuarios.find(u => u.uid === uid)
    return tecnico?.nome || 'Desconhecido'
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
            <button className="btn-primary" onClick={() => setAutoModalOpen(true)}>
              🪄 Nova Escala
            </button>
          </div>
        )}
      </div>

      <div className="escalas-toolbar">
        <div className="escalas-filters">
          <label>Filtrar por Equipe:</label>
          <select
            value={filterEquipe}
            onChange={(e) => {
              setFilterEquipe(e.target.value)
              setFilterTecnico('todos')
            }}
          >
            <option value="todas">📊 Todas as Equipes</option>
            {EQUIPES.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.label}</option>
            ))}
          </select>

          <label>Filtrar por Técnico/Analista:</label>
          <select value={filterTecnico} onChange={(e) => setFilterTecnico(e.target.value)}>
            <option value="todos">👥 Todos</option>
            {tecnicosParaFiltro.map(t => (
              <option key={t.uid} value={t.uid}>{t.nome}</option>
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
      </div>

      <EscalaEditModal
        open={modalOpen}
        formData={formData}
        setFormData={setFormData}
        canEdit={canEditCurrent}
        isAdmin={userData?.role === 'admin'}
        tecnicosDisponiveis={carregarTecnicosEquipe(userData?.role === 'admin' ? formData.equipe : userData?.equipe)}
        getNomeTecnico={getNomeTecnico}
        onSubmit={handleSubmit}
        onDelete={() => handleDelete(editingId)}
        onCancel={handleCancel}
        podeSolicitarTroca={podeSolicitarTroca}
        colegasParaTroca={colegasParaTroca}
        mostrarFormTroca={mostrarFormTroca}
        onAbrirFormTroca={() => setMostrarFormTroca(true)}
        onFecharFormTroca={() => setMostrarFormTroca(false)}
        tipoTroca={tipoTroca}
        setTipoTroca={setTipoTroca}
        diaTroca={diaTroca}
        setDiaTroca={setDiaTroca}
        destinoTroca={destinoTroca}
        setDestinoTroca={setDestinoTroca}
        enviandoTroca={enviandoTroca}
        onEnviarTroca={enviarSolicitacaoTroca}
        podePropinTroca={podePropinTroca}
        minhasEscalasParaOferecer={minhasEscalasParaOferecer}
        nomeTipoEscala={nomeTipoEscala}
        escalaOferecidaId={escalaOferecidaId}
        setEscalaOferecidaId={setEscalaOferecidaId}
        onEnviarPropostaTroca={enviarPropostaTroca}
      />

      {autoModalOpen && (
        <GeradorEscalaModal
          userData={userData}
          usuarios={usuarios}
          onClose={() => setAutoModalOpen(false)}
          onAtualizarEscalas={carregarEscalas}
        />
      )}

      <CalendarioEscalas
        escalas={escalasFiltradasPorEquipe}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        getNomeTecnico={getNomeTecnico}
        podeEditarEscala={podeEditarEscala}
        onEditarEscala={handleEdit}
        onDiaClick={setDiaDetalhado}
        usuarios={usuarios}
      />

      <DiaDetalhadoModal
        diaDetalhado={diaDetalhado}
        onClose={() => setDiaDetalhado(null)}
        onNavegarDia={navegarDiaDetalhado}
        podeEditarEscala={podeEditarEscala}
        onEditarEscala={handleEdit}
        getNomeTecnico={getNomeTecnico}
        usuarios={usuarios}
        baiasPerfil={baiasPerfil}
        laboratorioConfig={laboratorioConfig}
        salaCompartilhadaBaias={salaCompartilhadaBaias}
      />

      <div className="escalas-lista-detalhada-toggle">
        <label className="campo-toggle">
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={mostrarListaDetalhada}
              onChange={(e) => setMostrarListaDetalhada(e.target.checked)}
            />
            <span className="toggle-switch-slider"></span>
          </span>
          <span>Ver escalas detalhadas</span>
        </label>
      </div>

      {mostrarListaDetalhada && (
        <EscalasListaDetalhada
          escalas={escalasFiltradasPorEquipe}
          usuarios={usuarios}
          getNomeTecnico={getNomeTecnico}
          podeEditarEscala={podeEditarEscala}
          onEditarEscala={handleEdit}
          onDeletarEscala={handleDelete}
          onAtualizarEscalas={carregarEscalas}
        />
      )}
    </div>
  )
}
