import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { Loading } from '../../components/common/Loading'
import { Plus, Edit2, Trash2, Zap } from 'lucide-react'
import { getAllSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../services/schedules'
import { getAllScheduleGroups } from '../../services/scheduleGroups'
import { getAllTechnicians } from '../../services/technicians'
import { generateSaturdaySchedules, generateHomeOfficeSchedules, generateOncallSchedules } from '../../services/scheduleGenerator'
import { ScheduleList } from '../../components/schedule/ScheduleList'
import { SCHEDULE_TYPE_LABELS } from '../../utils/constants'
import { formatDate } from '../../utils/dateUtils'
import toast from 'react-hot-toast'

export const SchedulesAdmin = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [schedules, setSchedules] = useState([])
  const [groups, setGroups] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    groupId: '',
    technicianId: '',
    startDate: '',
    endDate: '',
  })
  const [generateData, setGenerateData] = useState({
    groupId: '',
    startDate: '',
    monthsOrWeeks: 1,
  })
  const [generatingLoading, setGeneratingLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [schedulesData, groupsData, techniciansData] = await Promise.all([
        getAllSchedules(),
        getAllScheduleGroups(),
        getAllTechnicians(),
      ])
      setSchedules(schedulesData)
      setGroups(groupsData)
      setTechnicians(techniciansData)
    } catch (error) {
      toast.error('Erro ao buscar dados')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (schedule = null) => {
    if (schedule) {
      setEditingId(schedule.id)
      const startDate = schedule.startDate?.toDate?.() || new Date(schedule.startDate)
      const endDate = schedule.endDate?.toDate?.() || new Date(schedule.endDate)
      setFormData({
        groupId: schedule.groupId,
        technicianId: schedule.technicianId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      })
    } else {
      setEditingId(null)
      setFormData({
        groupId: '',
        technicianId: '',
        startDate: '',
        endDate: '',
      })
    }
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateSchedule(editingId, {
          ...formData,
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
        })
        toast.success('Escala atualizada com sucesso')
      } else {
        await createSchedule({
          ...formData,
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
          isManuallyAssigned: true,
        })
        toast.success('Escala criada com sucesso')
      }
      setModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error('Erro ao salvar escala')
      console.error(error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta escala?')) {
      try {
        await deleteSchedule(id)
        toast.success('Escala deletada com sucesso')
        fetchData()
      } catch (error) {
        toast.error('Erro ao deletar escala')
        console.error(error)
      }
    }
  }

  const handleGenerateSchedules = async () => {
    if (!generateData.groupId) {
      toast.error('Selecione um grupo')
      return
    }

    try {
      setGeneratingLoading(true)
      const group = groups.find(g => g.id === generateData.groupId)
      const startDate = new Date(generateData.startDate)

      let ids
      if (group.type === 'saturday') {
        ids = await generateSaturdaySchedules(generateData.groupId, startDate, generateData.monthsOrWeeks)
      } else if (group.type === 'homeoffice') {
        ids = await generateHomeOfficeSchedules(generateData.groupId, startDate, generateData.monthsOrWeeks)
      } else {
        ids = await generateOncallSchedules(generateData.groupId, startDate, generateData.monthsOrWeeks, group.type)
      }

      toast.success(`${ids.length} escalas geradas com sucesso`)
      setGenerateModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error('Erro ao gerar escalas')
      console.error(error)
    } finally {
      setGeneratingLoading(false)
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
            <div className="flex items-center justify-between mb-8 gap-2 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-800">Escalas</h1>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => setGenerateModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Zap size={20} />
                  Gerar Automaticamente
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleOpenModal()}
                  className="flex items-center gap-2"
                >
                  <Plus size={20} />
                  Nova Escala
                </Button>
              </div>
            </div>

            <ScheduleList
              schedules={schedules}
              technicians={technicians}
              loading={false}
              onEdit={handleOpenModal}
              onDelete={handleDelete}
            />
          </div>
        </main>

        <BottomNav />
      </div>

      {/* Modal de Edição */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Escala' : 'Nova Escala'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Grupo
            </label>
            <select
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Selecione um grupo</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Técnico
            </label>
            <select
              value={formData.technicianId}
              onChange={(e) => setFormData({ ...formData, technicianId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Selecione um técnico</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
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

      {/* Modal de Geração */}
      <Modal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Gerar Escalas Automaticamente"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Grupo
            </label>
            <select
              value={generateData.groupId}
              onChange={(e) => setGenerateData({ ...generateData, groupId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Selecione um grupo</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={generateData.startDate}
              onChange={(e) => setGenerateData({ ...generateData, startDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Quantidade (meses ou semanas)
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={generateData.monthsOrWeeks}
              onChange={(e) => setGenerateData({ ...generateData, monthsOrWeeks: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="primary"
              onClick={handleGenerateSchedules}
              loading={generatingLoading}
              className="flex-1"
            >
              Gerar
            </Button>
            <Button variant="secondary" onClick={() => setGenerateModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}