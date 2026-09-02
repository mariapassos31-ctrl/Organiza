import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Users, Clock, LogIn } from 'lucide-react'
import { getAllScheduleGroups } from '../../services/scheduleGroups'
import { getAllSchedules } from '../../services/schedules'
import { getAllTechnicians } from '../../services/technicians'
import { useAuthStore } from '../../store/authStore'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { ScheduleCalendar } from '../../components/schedule/ScheduleCalendar'
import { Loading } from '../../components/common/Loading'
import { formatDate, getNextSaturday } from '../../utils/dateUtils'
import { SCHEDULE_TYPE_LABELS } from '../../utils/constants'

export const PublicDashboard = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [schedules, setSchedules] = useState([])
  const [groups, setGroups] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedulesData, groupsData, techniciansData] = await Promise.all([
          getAllSchedules(),
          getAllScheduleGroups(),
          getAllTechnicians(),
        ])
        setSchedules(schedulesData)
        setGroups(groupsData)
        setTechnicians(techniciansData)
      } catch (error) {
        console.error('Erro ao buscar dados:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const getNextScheduleByType = (type) => {
    const now = new Date()
    return schedules
      .filter(s => s.type === type && new Date(s.startDate?.toDate?.() || s.startDate) >= now)
      .sort((a, b) => new Date(a.startDate?.toDate?.() || a.startDate) - new Date(b.startDate?.toDate?.() || b.startDate))[0]
  }

  const getTechnicianName = (technicianId) => {
    return technicians.find(t => t.id === technicianId)?.fullName || 'Desconhecido'
  }

  if (loading) return <Loading fullScreen />

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-blue-600">Escala TI</h1>
          {!user ? (
            <Button
              variant="primary"
              onClick={() => navigate('/login')}
              className="flex items-center gap-2"
            >
              <LogIn size={20} />
              Entrar
            </Button>
          ) : (
            <div className="text-right">
              <p className="font-semibold text-gray-800">{user.displayName}</p>
              <p className="text-sm text-gray-500">{user.role}</p>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-20 md:pb-8">
        {/* Cards de Próximas Escalas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {groups.map(group => {
            const nextSchedule = getNextScheduleByType(group.type)
            return (
              <Card key={group.id} className="flex flex-col">
                <h3 className="font-semibold text-gray-700 text-sm mb-3">
                  {SCHEDULE_TYPE_LABELS[group.type]}
                </h3>
                {nextSchedule ? (
                  <>
                    <p className="text-2xl font-bold text-blue-600 mb-2">
                      {getTechnicianName(nextSchedule.technicianId)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(nextSchedule.startDate?.toDate?.() || nextSchedule.startDate)}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 text-sm">Sem escalas</p>
                )}
              </Card>
            )
          })}
        </div>

        {/* Calendário */}
        <div className="mb-8">
          <ScheduleCalendar schedules={schedules} />
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-4">
              <Users className="text-blue-600" size={32} />
              <div>
                <p className="text-gray-600 text-sm">Técnicos Ativos</p>
                <p className="text-2xl font-bold text-gray-800">
                  {technicians.filter(t => t.active).length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <Calendar className="text-green-600" size={32} />
              <div>
                <p className="text-gray-600 text-sm">Escalas Próximas</p>
                <p className="text-2xl font-bold text-gray-800">
                  {schedules.filter(s => new Date(s.startDate?.toDate?.() || s.startDate) >= new Date()).length}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-4">
              <Clock className="text-orange-600" size={32} />
              <div>
                <p className="text-gray-600 text-sm">Grupos de Escala</p>
                <p className="text-2xl font-bold text-gray-800">
                  {groups.length}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}