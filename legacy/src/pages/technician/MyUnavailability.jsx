import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { Loading } from '../../components/common/Loading'
import { Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getTechnicianByUserId } from '../../services/technicians'
import { getUnavailabilityByTechnician, createUnavailability, deleteUnavailability } from '../../services/unavailability'
import { formatDate } from '../../utils/dateUtils'
import toast from 'react-hot-toast'

export const MyUnavailability = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuthStore()
  const [unavailabilities, setUnavailabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
    reason: '',
  })

  useEffect(() => {
    fetchUnavailabilities()
  }, [user?.uid])

  const fetchUnavailabilities = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const techData = await getTechnicianByUserId(user.uid)
      if (techData) {
        const data = await getUnavailabilityByTechnician(techData.id)
        setUnavailabilities(data)
      }
    } catch (error) {
      toast.error('Erro ao buscar indisponibilidades')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.startDate || !formData.endDate) {
      toast.error('Preencha as datas')
      return
    }

    try {
      const techData = await getTechnicianByUserId(user.uid)
      await createUnavailability({
        technicianId: techData.id,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        reason: formData.reason,
      })
      toast.success('Indisponibilidade registrada com sucesso')
      setModalOpen(false)
      setFormData({ startDate: '', endDate: '', reason: '' })
      fetchUnavailabilities()
    } catch (error) {
      toast.error('Erro ao registrar indisponibilidade')
      console.error(error)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta indisponibilidade?')) {
      try {
        await deleteUnavailability(id)
        toast.success('Indisponibilidade deletada com sucesso')
        fetchUnavailabilities()
      } catch (error) {
        toast.error('Erro ao deletar indisponibilidade')
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
              <h1 className="text-3xl font-bold text-gray-800">Minhas Indisponibilidades</h1>
              <Button
                variant="primary"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus size={20} />
                Adicionar
              </Button>
            </div>

            {unavailabilities.length === 0 ? (
              <Card>
                <p className="text-center text-gray-500 py-8">Nenhuma indisponibilidade registrada</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {unavailabilities.map(unavail => (
                  <Card key={unavail.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">
                          {formatDate(unavail.startDate?.toDate?.() || unavail.startDate)} até{' '}
                          {formatDate(unavail.endDate?.toDate?.() || unavail.endDate)}
                        </h3>
                        {unavail.reason && (
                          <p className="text-sm text-gray-600 mt-2">{unavail.reason}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(unavail.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>

        <BottomNav />
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Registrar Indisponibilidade"
      >
        <div className="space-y-4">
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo (opcional)
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Férias, doença, etc"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              rows="3"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="primary" onClick={handleSave} className="flex-1">
              Registrar
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