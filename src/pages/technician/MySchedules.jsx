import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Loading } from '../../components/common/Loading'
import { useAuthStore } from '../../store/authStore'
import { getTechnicianByUserId } from '../../services/technicians'
import { getSchedulesByTechnician } from '../../services/schedules'
import { ScheduleCalendar } from '../../components/schedule/ScheduleCalendar'
import { formatDate, formatDateLong } from '../../utils/dateUtils'
import { SCHEDULE_TYPE_LABELS } from '../../utils/constants'
import toast from 'react-hot-toast'

export const MySchedules = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuthStore()
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchSchedules()
  }, [user?.uid])

  const fetchSchedules = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      const techData = await getTechnicianByUserId(user.uid)
      if (techData) {
        const data = await getSchedulesByTechnician(techData.id)
        setSchedules(data.sort((a, b) => 
          new Date(a.startDate?.toDate?.() || a.startDate) - new Date(b.startDate?.toDate?.() || b.startDate)
        ))
      }
    } catch (error) {
      toast.error('Erro ao buscar escalas')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSchedules = filterType === 'all' 
    ? schedules 
    : schedules.filter(s => s.type === filterType)

  if (loading) return <Loading fullScreen />

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Minhas Escalas</h1>

            {/* Calendário */}
            <div className="mb-8">
              <ScheduleCalendar schedules={schedules} />
            </div>

            {/* Filtros */}
            <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={filterType === 'all' ? 'primary' : 'secondary'}
                onClick={() => setFilterType('all')}
                size="sm"
              >
                Todas
              </Button>
              {['saturday', 'homeoffice', 'oncall_systems', 'oncall_infra'].map(type => (
                <Button
                  key={type}
                  variant={filterType === type ? 'primary' : 'secondary'}
                  onClick={() => setFilterType(type)}
                  size="sm"
                >
                  {SCHEDULE_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>

            {/* Lista de Escalas */}
            {filteredSchedules.length === 0 ? (
              <Card>
                <p className="text-center text-gray-500 py-8">Nenhuma escala encontrada</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredSchedules.map(schedule => {
                  const startDate = schedule.startDate?.toDate?.() || new Date(schedule.startDate)
                  const isPast = startDate < new Date()

                  return (
                    <Card key={schedule.id} className={isPast ? 'opacity-60' : ''}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800">
                            {SCHEDULE_TYPE_LABELS[schedule.type]}
                          </h3>
                          <p className="text-sm text-gray-600 mt-2">
                            {formatDateLong(startDate)}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          isPast 
                            ? 'bg-gray-100 text-gray-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {isPast ? 'Concluída' : 'Próxima'}
                        </span>
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