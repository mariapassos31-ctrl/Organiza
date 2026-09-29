'use client'

import { useSession } from 'next-auth/react'

export function useAuthUser() {
  const { data: session, status } = useSession()

  return {
    user: session?.user ?? null,
    loading: status === 'loading',
  }
}
