import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Loading } from '../../components/common/Loading'
import { Users, Calendar, Swap2, AlertCircle } from 'lucide-react'
import { getAllTechnicians } from '../../services/technicians'
import { getAllSchedules } from '../../services/schedules'
import { getPendingSwapRequests } from '../../services/swaps'
import { getAllUnavailability } from '../../services/unavailability'

export const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState({
    technicians: 0,
    schedules: 0,
    pendingSwaps: 0,
    unavailabilities: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [technicians, schedules, swaps, unavailability] = await Promise.all([
          getAllTechnicians(),
          getAllSchedules(),
          getPendingSwapRequests(),
          getAllUnavailability(),
        ])

        setStats({
          technicians: technicians.filter(t => t.active).length,
          schedules: schedules.length,
          pendingSwaps: swaps.length,
          unavailabilities: unavailability.length,
        })
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) return <Loading fullScreen />

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard Administrativo</h1>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Técnicos Ativos</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.technicians}</p>
                  </div>
                  <Users className="text-blue-600" size={40} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Escalas Cadastradas</p>
                    <p className="text-3xl font-bold text-green-600">{stats.schedules}</p>
                  </div>
                  <Calendar className="text-green-600" size={40} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Trocas Pendentes</p>
                    <p className="text-3xl font-bold text-orange-600">{stats.pendingSwaps}</p>
                  </div>
                  <Swap2 className="text-orange-600" size={40} />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Indisponibilidades</p>
                    <p className="text-3xl font-bold text-red-600">{stats.unavailabilities}</p>
                  </div>
                  <AlertCircle className="text-red-600" size={40} />
                </div>
              </Card>
            </div>

            {/* Ações Rápidas */}
            <Card>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Ações Rápidas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button variant="primary" className="w-full">
                  Novo Técnico
                </Button>
                <Button variant="primary" className="w-full">
                  Novo Grupo
                </Button>
                <Button variant="primary" className="w-full">
                  Gerar Escalas
                </Button>
                <Button variant="primary" className="w-full">
                  Aprovar Trocas
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