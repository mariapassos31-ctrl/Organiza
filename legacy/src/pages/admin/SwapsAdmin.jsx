import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Loading } from '../../components/common/Loading'
import { Check, X } from 'lucide-react'
import { getPendingSwapRequests, acceptSwapRequest, rejectSwapRequest, updateSchedule } from '../../services/swaps'
import { getScheduleById, updateSchedule as updateScheduleService } from '../../services/schedules'
import { getTechnicianById } from '../../services/technicians'
import { formatDate } from '../../utils/dateUtils'
import { SWAP_STATUS_LABELS } from '../../utils/constants'
import toast from 'react-hot-toast'

export const SwapsAdmin = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [swaps, setSwaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [swapDetails, setSwapDetails] = useState({})

  useEffect(() => {
    fetchSwaps()
  }, [])

  const fetchSwaps = async () => {
    try {
      setLoading(true)
      const swapsData = await getPendingSwapRequests()
      
      // Buscar detalhes de cada troca
      const details = {}
      for (const swap of swapsData) {
        const schedule = await getScheduleById(swap.scheduleId)
        const requester = await getTechnicianById(swap.requestedBy)
        const target = swap.targetTechnician ? await getTechnicianById(swap.targetTechnician) : null
        
        details[swap.id] = { schedule, requester, target }
      }
      
      setSwaps(swapsData)
      setSwapDetails(details)
    } catch (error) {
      toast.error('Erro ao buscar trocas')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (swapId) => {
    try {
      const swap = swaps.find(s => s.id === swapId)
      const schedule = swapDetails[swapId]?.schedule

      // Atualizar escala com novo técnico
      await updateScheduleService(swap.scheduleId, {
        technicianId: swap.targetTechnician || swap.requestedBy,
      })

      // Atualizar status da troca
      await acceptSwapRequest(swapId, 'admin')
      
      toast.success('Troca aprovada com sucesso')
      fetchSwaps()
    } catch (error) {
      toast.error('Erro ao aprovar troca')
      console.error(error)
    }
  }

  const handleReject = async (swapId) => {
    try {
      await rejectSwapRequest(swapId)
      toast.success('Troca rejeitada com sucesso')
      fetchSwaps()
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
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Solicitações de Troca</h1>

            {swaps.length === 0 ? (
              <Card>
                <p className="text-center text-gray-500 py-8">Nenhuma solicitação de troca pendente</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {swaps.map(swap => {
                  const details = swapDetails[swap.id]
                  if (!details) return null

                  return (
                    <Card key={swap.id}>
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-gray-800">
                              {details.requester?.fullName} solicita troca
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Data: {formatDate(details.schedule?.startDate?.toDate?.() || details.schedule?.startDate)}
                            </p>
                          </div>
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">
                            {SWAP_STATUS_LABELS[swap.status]}
                          </span>
                        </div>

                        {details.target && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600">Proposto para:</p>
                            <p className="font-semibold text-gray-800">{details.target.fullName}</p>
                          </div>
                        )}

                        {swap.reason && (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">Motivo:</p>
                            <p className="text-gray-800">{swap.reason}</p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-4">
                          <Button
                            variant="success"
                            onClick={() => handleApprove(swap.id)}
                            className="flex-1 flex items-center justify-center gap-2"
                          >
                            <Check size={20} />
                            Aprovar
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleReject(swap.id)}
                            className="flex-1 flex items-center justify-center gap-2"
                          >
                            <X size={20} />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  )
}