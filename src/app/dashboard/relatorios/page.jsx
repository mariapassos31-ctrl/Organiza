'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Relatorios from '../../../components/dashboard/Relatorios'

export default function RelatoriosPage() {
  const { userData } = useDashboardUser()

  return (
    <ProtectedRoute requiredRoles={['admin', 'gestor']} userData={userData}>
      <Relatorios />
    </ProtectedRoute>
  )
}
