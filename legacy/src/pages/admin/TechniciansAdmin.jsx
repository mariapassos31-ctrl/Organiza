import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { Loading } from '../../components/common/Loading'
import { Plus, Edit2, Trash2, Toggle2On, Toggle2Off } from 'lucide-react'
import { getAllTechnicians, createTechnician, updateTechnician, deleteTechnician, toggleTechnicianStatus } from '../../services/technicians'
import { SCHEDULE_TYPES } from '../../utils/constants'
import toast from 'react-hot-toast'

export const TechniciansAdmin = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    team: '',
    scheduleTypes: [],
  })

  useEffect(() => {
    fetchTechnicians()
  }, [])

  const fetchTechnicians = async () => {
    try {
      setLoading(true)
      const data = await getAllTechnicians()
      setTechnicians(data)
    } catch (error) {
      toast.error('Erro ao buscar técnicos')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (technician = null) => {
    if (technician) {
      setEditingId(technician.id)
      setFormData({
        fullName: technician.fullName,
        email: technician.email,
        phone: technician.phone || '',
        team: technician.team,
        scheduleTypes: technician.scheduleTypes || [],
      })
    } else {
      setEditingId(null)
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        team: '',
        scheduleTypes: [],
      })
    }
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateTechnician(editingId, formData)
        toast.success('Técnico atualizado com sucesso')
      } else {
        await createTechnician(formData)
        toast.success('Técnico criado com sucesso')
      }
      setModalOpen(false)
      fetchTechnicians()
    } catch (error) {
      toast.error('Erro ao salvar técnico')
      console.error(error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este técnico?')) {
      try {
        await deleteTechnician(id)
        toast.success('Técnico deletado com sucesso')
        fetchTechnicians()
      } catch (error) {
        toast.error('Erro ao deletar técnico')
        console.error(error)
      }
    }
  }

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await toggleTechnicianStatus(id, !currentStatus)
      toast.success('Status atualizado com sucesso')
      fetchTechnicians()
    } catch (error) {
      toast.error('Erro ao atualizar status')
      console.error(error)
    }
  }

  if (loading) return <Loading fullScreen />

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold text-gray-800">Técnicos</h1>
              <Button
                variant="primary"
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2"
              >
                <Plus size={20} />
                Novo Técnico
              </Button>
            </div>

            {/* Tabela de Técnicos */}
            <div className="space-y-4">
              {technicians.map(technician => (
                <Card key={technician.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800">{technician.fullName}</h3>
                      <p className="text-sm text-gray-600">{technician.email}</p>
                      <p className="text-xs text-gray-500 mt-1">{technician.team}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(technician.id, technician.active)}
                        className={`p-2 rounded-lg transition-colors ${
                          technician.active
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {technician.active ? <Toggle2On size={20} /> : <Toggle2Off size={20} />}
                      </button>
                      <button
                        onClick={() => handleOpenModal(technician)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(technician.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </main>

        <BottomNav />
      </div>

      {/* Modal de Edição */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Técnico' : 'Novo Técnico'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nome Completo
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              E-mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Telefone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Equipe
            </label>
            <input
              type="text"
              value={formData.team}
              onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipos de Escala
            </label>
            <div className="space-y-2">
              {Object.entries(SCHEDULE_TYPES).map(([key, value]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.scheduleTypes.includes(value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          scheduleTypes: [...formData.scheduleTypes, value],
                        })
                      } else {
                        setFormData({
                          ...formData,
                          scheduleTypes: formData.scheduleTypes.filter(t => t !== value),
                        })
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-700">{key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="primary" onClick={handleSave} className="flex-1">
              Salvar
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}