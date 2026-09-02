import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { Loading } from '../../components/common/Loading'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { getAllScheduleGroups, createScheduleGroup, updateScheduleGroup, deleteScheduleGroup } from '../../services/scheduleGroups'
import { getAllTechnicians } from '../../services/technicians'
import { SCHEDULE_TYPES, SCHEDULE_TYPE_LABELS } from '../../utils/constants'
import toast from 'react-hot-toast'

export const ScheduleGroupsAdmin = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [groups, setGroups] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    technicians: [],
    rotationOrder: [],
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [groupsData, techniciansData] = await Promise.all([
        getAllScheduleGroups(),
        getAllTechnicians(),
      ])
      setGroups(groupsData)
      setTechnicians(techniciansData.filter(t => t.active))
    } catch (error) {
      toast.error('Erro ao buscar dados')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (group = null) => {
    if (group) {
      setEditingId(group.id)
      setFormData({
        name: group.name,
        type: group.type,
        description: group.description || '',
        technicians: group.technicians || [],
        rotationOrder: group.rotationOrder || group.technicians || [],
      })
    } else {
      setEditingId(null)
      setFormData({
        name: '',
        type: '',
        description: '',
        technicians: [],
        rotationOrder: [],
      })
    }
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateScheduleGroup(editingId, formData)
        toast.success('Grupo atualizado com sucesso')
      } else {
        await createScheduleGroup(formData)
        toast.success('Grupo criado com sucesso')
      }
      setModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error('Erro ao salvar grupo')
      console.error(error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este grupo?')) {
      try {
        await deleteScheduleGroup(id)
        toast.success('Grupo deletado com sucesso')
        fetchData()
      } catch (error) {
        toast.error('Erro ao deletar grupo')
        console.error(error)
      }
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
              <h1 className="text-3xl font-bold text-gray-800">Grupos de Escala</h1>
              <Button
                variant="primary"
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2"
              >
                <Plus size={20} />
                Novo Grupo
              </Button>
            </div>

            <div className="space-y-4">
              {groups.map(group => (
                <Card key={group.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800">{group.name}</h3>
                      <p className="text-sm text-gray-600">
                        {SCHEDULE_TYPE_LABELS[group.type]}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {group.technicians?.length || 0} técnicos
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(group)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
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

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Grupo' : 'Novo Grupo'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nome
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Escala
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Selecione um tipo</option>
              {Object.entries(SCHEDULE_TYPES).map(([key, value]) => (
                <option key={value} value={value}>
                  {SCHEDULE_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Técnicos
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {technicians.map(tech => (
                <label key={tech.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.technicians.includes(tech.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          technicians: [...formData.technicians, tech.id],
                          rotationOrder: [...formData.rotationOrder, tech.id],
                        })
                      } else {
                        setFormData({
                          ...formData,
                          technicians: formData.technicians.filter(id => id !== tech.id),
                          rotationOrder: formData.rotationOrder.filter(id => id !== tech.id),
                        })
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-700">{tech.fullName}</span>
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