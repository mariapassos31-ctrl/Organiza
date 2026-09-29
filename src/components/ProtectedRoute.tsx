'use client'

import { useEffect, type ReactNode } from 'react'
import type { UsuarioLogado } from '../types/dominio'
import { useRouter } from 'next/navigation'

export default function ProtectedRoute({ children, requiredRoles, userData }: {
  children: ReactNode
  requiredRoles?: string[]
  userData: UsuarioLogado | null
}) {
  const router = useRouter()

  const hasAccess = userData
    ? !Array.isArray(requiredRoles) || requiredRoles.includes(userData.role)
    : false

  useEffect(() => {
    if (!userData) {
      router.replace('/login')
      return
    }

    if (Array.isArray(requiredRoles) && !requiredRoles.includes(userData.role)) {
      router.replace('/dashboard')
    }
  }, [userData, requiredRoles, router])

  if (!hasAccess) {
    return null
  }

  return children
}
