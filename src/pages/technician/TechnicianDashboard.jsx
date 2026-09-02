import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Loading } from '../../components/common/Loading'
import { Calendar, AlertCircle, Swap2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getTechnicianByUserId } from '../../services/technicians'
import { getSchedulesByTechnician } from '../../services/schedules'
import { getUnavailabilityByTechnician } from '../../services/unavailability'
import { getSwapsByTechnician } from '../../services/swaps'
import { formatDate, formatDateLong } from '../../utils/dateUtils'
import { SCHEDULE_TYPE_LABELS, SWAP_STATUS_LABELS } from '../../utils/constants'
import toast from 'react-hot-toast'

export const TechnicianDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuthStore()
  const [technician, setTechnician] = useState(null)
  const [nextSchedules, setNextSchedules] = useState([])
  const [unavailabilities, setUnavailabilities] = useState([])
  const [pendingSwaps, setPendingSwaps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [user?.uid])

  const fetchData = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const techData = await getTechnicianByUserId(user.uid)
      setTechnician(techData)

      if (techData) {
        const [schedules, unavail, swaps] = await Promise.all([
          getSchedulesByTechnician(techData.id),
          getUnavailabilityByTechnician(techData.id),
          getSwapsByTechnician(techData.id),
        ])

        // Filtrar próximas escalas
        const now = new Date()
        const next = schedules
          .filter(s => new Date(s.startDate?.toDate?.() || s.startDate) >= now)
          .sort((a, b) => new Date(a.startDate?.toDate?.() || a.startDate) - new Date(b.startDate?.toDate?.() || b.startDate))
          .slice(0, 3)

        setNextSchedules(next)
        setUnavailabilities(unavail)
        setPendingSwaps(swaps.filter(s => s.status === 'pending'))
      }
    } catch (error) {
      toast.error('Erro ao buscar dados')
      console.error(error)
    } finally {
      setLoading(false)
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
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-800">
                Bem-vindo, {technician?.fullName}!
              </h1>
              <p className="text-gray-600 mt-2">{technician?.team}</p>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Próximas Escalas</p>
                    <p className="text-3xl font-bold text-blue-600">{nextSchedules.length}</p>
                  </div>
                  <Calendar className="text-blue-600" size={40} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Indisponibilidades</p>
                    <p className="text-3xl font-bold text-orange-600">{unavailabilities.length}</p>
                  </div>
                  <AlertCircle className="text-orange-600" size={40} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Trocas Pendentes</p>
                    <p className="text-3xl font-bold text-purple-600">{pendingSwaps.length}</p>
                  </div>
                  <Swap2 className="text-purple-600" size={40} />
                </div>
              </Card>
            </div>

            {/* Próximas Escalas */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Próximas Escalas</h2>
              {nextSchedules.length === 0 ? (
                <Card>
                  <p className="text-center text-gray-500 py-8">Nenhuma escala próxima</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {nextSchedules.map(schedule => (
                    <Card key={schedule.id}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-gray-800">
                            {SCHEDULE_TYPE_LABELS[schedule.type]}
                          </h3>
                          <p className="text-sm text-gray-600 mt-2">
                            {formatDateLong(schedule.startDate?.toDate?.() || schedule.startDate)}
                          </p>
                        </div>
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                          Confirmado
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Ações Rápidas */}
            <Card>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Ações Rápidas</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="primary" className="w-full">
                  Minhas Escalas
                </Button>
                <Button variant="primary" className="w-full">
                  Solicitar Troca
                </Button>
                <Button variant="primary" className="w-full">
                  Indisponibilidade
                </Button>
              </div>
            </Card>
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  )
}