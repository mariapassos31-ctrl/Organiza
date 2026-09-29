'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'
import ProtectedRoute from '../../../components/ProtectedRoute'
import ManualUso from '../../../components/dashboard/ManualUso'

export default function ManualPage() {
  const { userData } = useDashboardUser()

  return (
    <ProtectedRoute userData={userData}>
      <ManualUso />
    </ProtectedRoute>
  )
}
