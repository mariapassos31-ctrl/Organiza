'use client'

import { createContext, useContext } from 'react'

const DashboardUserContext = createContext(null)

export function DashboardUserProvider({ value, children }) {
  return (
    <DashboardUserContext.Provider value={value}>
      {children}
    </DashboardUserContext.Provider>
  )
}

export function useDashboardUser() {
  return useContext(DashboardUserContext) || {}
}
