'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { UsuarioLogado } from '../types/dominio'

interface DashboardUserValue {
  user: UsuarioLogado | null
  userData: UsuarioLogado | null
}

const DashboardUserContext = createContext<DashboardUserValue | null>(null)

export function DashboardUserProvider({ value, children }: { value: DashboardUserValue; children: ReactNode }) {
  return (
    <DashboardUserContext.Provider value={value}>
      {children}
    </DashboardUserContext.Provider>
  )
}

export function useDashboardUser(): DashboardUserValue {
  return useContext(DashboardUserContext) || { user: null, userData: null }
}
