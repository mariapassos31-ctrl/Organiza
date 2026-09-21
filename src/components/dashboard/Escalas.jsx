'use client'

import { useState, useEffect } from 'react'

import { useDashboardUser } from '../../context/DashboardUserContext'
import { EQUIPES } from '../../lib/equipesConfig'
import { TIPOS_ESCALA } from '../../lib/escalasConstants'
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
  const [modalOpen, setModalOpen] = useState(false)
  const [diaDetalhado, setDiaDetalhado] = useState(null)
  const [autoModalOpen, setAutoModalOpen] = useState(false)

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
    if (userData?.role === 'gestor') {
      setFormData(prev => ({ ...prev, equipe: userData.equipe }))
    }
    carregarUsuarios()
    carregarEscalas()
  }, [userData])

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

  const podeEditar = userData?.role === 'admin' || userData?.role === 'gestor'

  const podeEditarEscala = (escala) => {
    if (userData?.role === 'admin') return true
    if (userData?.role === 'gestor' && escala.equipe === userData.equipe) return true
    return false
  }

  const canEditCurrent = modalOpen && editingId ? podeEditarEscala(formData) : false

  const escalasFiltradasPorEquipe = filterEquipe === 'todas'
    ? escalas
    : escalas.filter(e => e.equipe === filterEquipe)

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
      />

      <DiaDetalhadoModal
        diaDetalhado={diaDetalhado}
        onClose={() => setDiaDetalhado(null)}
        podeEditarEscala={podeEditarEscala}
        onEditarEscala={handleEdit}
        getNomeTecnico={getNomeTecnico}
        usuarios={usuarios}
      />

      <EscalasListaDetalhada
        escalas={escalasFiltradasPorEquipe}
        usuarios={usuarios}
        getNomeTecnico={getNomeTecnico}
        podeEditarEscala={podeEditarEscala}
        onEditarEscala={handleEdit}
        onDeletarEscala={handleDelete}
        onAtualizarEscalas={carregarEscalas}
      />
    </div>
  )
}
