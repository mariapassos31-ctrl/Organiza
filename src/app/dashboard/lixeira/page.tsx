'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Lixeira from '../../../components/dashboard/Lixeira'

export default function LixeiraPage() {
  const { userData } = useDashboardUser()

  return (
    <ProtectedRoute requiredRoles={['admin', 'gestor', 'lider']} userData={userData}>
      <Lixeira />
    </ProtectedRoute>
  )
}
