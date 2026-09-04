'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Escalas from '../../../components/dashboard/Escalas'

export default function EscalasPage() {
  const { userData } = useDashboardUser()

  return (
    <ProtectedRoute requiredRoles={['admin', 'gestor', 'tecnico', 'analista']} userData={userData}>
      <Escalas />
    </ProtectedRoute>
  )
}
