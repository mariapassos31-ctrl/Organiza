'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Trocas from '../../../components/dashboard/Trocas'

export default function TrocasPage() {
  const { userData } = useDashboardUser()

  return (
    <ProtectedRoute userData={userData}>
      <Trocas />
    </ProtectedRoute>
  )
}
