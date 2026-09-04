'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Usuarios from '../../../components/dashboard/Usuarios'

export default function UsuariosPage() {
  const { userData } = useDashboardUser()

  return (
    <ProtectedRoute requiredRoles={['admin', 'gestor']} userData={userData}>
      <Usuarios />
    </ProtectedRoute>
  )
}
