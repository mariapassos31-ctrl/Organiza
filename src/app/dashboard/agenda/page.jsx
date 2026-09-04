'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import MinhaAgenda from '../../../components/dashboard/MinhaAgenda'

export default function AgendaPage() {
  const { userData } = useDashboardUser()

  return (
    <ProtectedRoute requiredRoles={['admin', 'gestor', 'tecnico', 'analista']} userData={userData}>
      <MinhaAgenda />
    </ProtectedRoute>
  )
}
