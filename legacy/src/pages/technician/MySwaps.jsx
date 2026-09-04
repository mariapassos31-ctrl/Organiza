import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { Loading } from '../../components/common/Loading'
import { Plus, Check, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getTechnicianByUserId, getAllTechnicians } from '../../services/technicians'
import { getSchedulesByTechnician, getScheduleById } from '../../services/schedules'
import { getSwapsByTechnician, getSwapsReceivedByTechnician, createSwapRequest, acceptSwapRequest, rejectSwapRequest } from '../../services/swaps'
import { formatDate } from '../../utils/dateUtils'
import { SWAP_STATUS_LABELS } from '../../utils/constants'
import toast from 'react-hot-toast'

export const MySwaps = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuthStore()
  const [mySwaps, setMySwaps] = useState([])
  const [receivedSwaps, setReceivedSwaps] = useState([])
  const [schedules, setSchedules] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    scheduleId: '',
    targetTechnician: '',
    reason: '',
  })

  useEffect(() => {
    fetchData()
  }, [user?.uid])

  const fetchData = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const techData = await getTechnicianByUserId(user.uid)
      if (techData) {
        const [mySwapsData, receivedSwapsData, schedulesData, techniciansData] = await Promise.all([
          getSwapsByTechnician(techData.id),
          getSwapsReceivedByTechnician(techData.id),
          getSchedulesByTechnician(techData.id),
          getAllTechnicians(),
        ])

        setMySwaps(mySwapsData)
        setReceivedSwaps(receivedSwapsData)
        setSchedules(schedulesData)
        setTechnicians(techniciansData.filter(t => t.id !== techData.id))
      }
    } catch (error) {
      toast.error('Erro ao buscar trocas')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSwap = async () => {
    if (!formData.scheduleId) {
      toast.error('Selecione uma escala')
      return
    }

    try {
      const techData = await getTechnicianByUserId(user.uid)
      await createSwapRequest({
        scheduleId: formData.scheduleId,
        requestedBy: techData.id,
        targetTechnician: formData.targetTechnician || null,
        reason: formData.reason,
      })
      toast.success('Solicitação de troca criada com sucesso')
      setModalOpen(false)
      setFormData({ scheduleId: '', targetTechnician: '', reason: '' })
      fetchData()
    } catch (error) {
      toast.error('Erro ao criar solicitação de troca')
      console.error(error)
    }
  }

  const handleAcceptSwap = async (swapId) => {
    try {
      const techData = await getTechnicianByUserId(user.uid)
      await acceptSwapRequest(swapId, techData.id)
      toast.success('Troca aceita com sucesso')
      fetchData()
    } catch (error) {
      toast.error('Erro ao aceitar troca')
      console.error(error)
    }
  }

  const handleRejectSwap = async (swapId) => {
    try {
      await rejectSwapRequest(swapId)
      toast.success('Troca rejeitada com sucesso')
      fetchData()
    } catch (error) {
      toast.error('Erro ao rejeitar troca')
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
              <h1 className="text-3xl font-bold text-gray-800">Minhas Trocas</h1>
              <Button
                variant="primary"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus size={20} />
                Solicitar Troca
              </Button>
            </div>

            {/* Minhas Solicitações */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Minhas Solicitações</h2>
              {mySwaps.length === 0 ? (
                <Card>
                  <p className="text-center text-gray-500 py-8">Nenhuma solicitação enviada</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {mySwaps.map(swap => (
                    <Card key={swap.id}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800">
                            Solicitação de Troca
                          </h3>
                          <p className="text-sm text-gray-600 mt-2">
                            Status: {SWAP_STATUS_LABELS[swap.status]}
                          </p>
                          {swap.reason && (
                            <p className="text-sm text-gray-600 mt-1">{swap.reason}</p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          swap.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          swap.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {SWAP_STATUS_LABELS[swap.status]}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Solicitações Recebidas */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Solicitações Recebidas</h2>
              {receivedSwaps.length === 0 ? (
                <Card>
                  <p className="text-center text-gray-500 py-8">Nenhuma solicitação recebida</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {receivedSwaps.map(swap => (
                    <Card key={swap.id}>
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-gray-800">
                              Solicitação de Troca
                            </h3>
                            <p className="text-sm text-gray-600 mt-2">
                              Status: {SWAP_STATUS_LABELS[swap.status]}
                            </p>
                          </div>
                          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                            {SWAP_STATUS_LABELS[swap.status]}
                          </span>
                        </div>

                        {swap.status === 'pending' && (
                          <div className="flex gap-2 pt-4">
                            <Button
                              variant="success"
                              onClick={() => handleAcceptSwap(swap.id)}
                              className="flex-1 flex items-center justify-center gap-2"
                            >
                              <Check size={20} />
                              Aceitar
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => handleRejectSwap(swap.id)}
                              className="flex-1 flex items-center justify-center gap-2"
                            >
                              <X size={20} />
                              Rejeitar
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <BottomNav />
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Solicitar Troca"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Escala
            </label>
            <select
              value={formData.scheduleId}
              onChange={(e) => setFormData({ ...formData, scheduleId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Selecione uma escala</option>
              {schedules.map(schedule => (
                <option key={schedule.id} value={schedule.id}>
                  {formatDate(schedule.startDate?.toDate?.() || schedule.startDate)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Técnico (opcional)
            </label>
            <select
              value={formData.targetTechnician}
              onChange={(e) => setFormData({ ...formData, targetTechnician: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Deixar aberto para interessados</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Por que você quer trocar?"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              rows="3"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="primary" onClick={handleCreateSwap} className="flex-1">
              Solicitar
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