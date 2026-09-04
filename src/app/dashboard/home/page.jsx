'use client'

import { useDashboardUser } from '../../../context/DashboardUserContext'

export default function DashboardHome() {
  const { userData } = useDashboardUser()

  return (
    <div className="page-home">
      <h1>Bem-vindo, {userData?.nome}!</h1>
    </div>
  )
}
