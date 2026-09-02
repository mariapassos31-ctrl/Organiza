import React, { useState, useEffect } from 'react'
import { Header } from '../../components/common/Header'
import { Sidebar } from '../../components/common/Sidebar'
import { BottomNav } from '../../components/common/BottomNav'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Loading } from '../../components/common/Loading'
import { Trash2 } from 'lucide-react'
import { getAllUnavailability, deleteUnavailability } from '../../services/unavailability'
import { getTechnicianById } from '../../services/technicians'
import { formatDate } from '../../utils/dateUtils'
import toast from 'react-hot-toast'

export const UnavailabilityAdmin = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unavailabilities, setUnavailabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [technicianNames, setTechnicianNames] = useState({})

  useEffect(() => {
    fetchUnavailabilities()
  }, [])

  const fetchUnavailabilities = async () => {
    try {
      setLoading(true)
      const data = await getAllUnavailability()
      setUnavailabilities(data)

      // Buscar nomes dos técnicos
      const names = {}
      for (const unavail of data) {
        if (!names[unavail.technicianId]) {
          const tech = await getTechnicianById(unavail.technicianId)
          names[unavail.technicianId] = tech?.fullName || 'Desconhecido'
        }
      }
      setTechnicianNames(names)
    } catch (error) {
      toast.error('Erro ao buscar indisponibilidades')
      console.error(error)
    } finally {
      setLoading(false)
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
            <h1 className="text-3xl font-bold text-gray-800 mb-8">Indisponibilidades</h1>

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
                          {technicianNames[unavail.technicianId]}
                        </h3>
                        <p className="text-sm text-gray-600 mt-2">
                          📅 {formatDate(unavail.startDate?.toDate?.() || unavail.startDate)} até{' '}
                          {formatDate(unavail.endDate?.toDate?.() || unavail.endDate)}
                        </p>
                        {unavail.reason && (
                          <p className="text-sm text-gray-600 mt-2">
                            💬 {unavail.reason}
                          </p>
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
    </div>
  )
}