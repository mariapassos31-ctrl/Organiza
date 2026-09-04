'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthUser } from '../hooks/useAuthUser'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuthUser()

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/login')
    }
  }, [loading, user, router])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      Carregando...
    </div>
  )
}
