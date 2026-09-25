'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAuthUser } from '../../hooks/useAuthUser'
import { DashboardUserProvider } from '../../context/DashboardUserContext'
import { ehPerfilGestao, labelPerfil } from '../../lib/equipesConfig'
import { Sidebar, type ItemMenu } from '../../components/layout/Sidebar'
import { LayoutDashboard, Users, CalendarDays, Repeat, BarChart3, BookOpen } from 'lucide-react'
import '../../styles/Escalas.css'
import '../../styles/Dashboard.css'
import '../../styles/argos-theme.css'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthUser()
  const [trocasPendentes, setTrocasPendentes] = useState(0)

  const userData = user
    ? {
        uid: user.id,
        nome: user.name ?? "",
        email: user.email ?? "",
        role: user.role,
        equipe: user.equipe,
      }
    : null

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!userData) return
    let cancelled = false

    const carregarPendentes = async () => {
      try {
        const res = await fetch('/api/trocas')
        const data = await res.json()
        if (cancelled || !Array.isArray(data)) return
        const count = (userData.role === 'admin' || userData.role === 'gestor')
          ? data.filter(t => t.status === 'pendente').length
          : data.filter(t => t.status === 'pendente' && t.destinoUid === userData.uid).length
        setTrocasPendentes(count)
      } catch {
        // silencioso: badge só é um indicativo, não crítico
      }
    }

    carregarPendentes()
    const intervalo = setInterval(carregarPendentes, 60000)
    return () => {
      cancelled = true
      clearInterval(intervalo)
    }
  }, [userData?.uid, userData?.role, userData?.equipe])

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false })
      router.push('/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (!user || !userData) {
    return <div className="loading">Carregando...</div>
  }

  // Menu por perfil: gestão (admin/gestor/líder) vê tudo; qualquer
  // colaborador (técnico, analista, perfil livre) vê Escalas, Trocas e Manual.
  const escalas: ItemMenu = { label: 'Escalas', href: '/dashboard/escalas', icon: CalendarDays }
  const trocas: ItemMenu = { label: 'Trocas', href: '/dashboard/trocas', icon: Repeat, badge: trocasPendentes }
  const manual: ItemMenu = { label: 'Manual', href: '/dashboard/manual', icon: BookOpen }

  const menuItems: ItemMenu[] = ehPerfilGestao(userData.role)
    ? [
        { label: 'Painel', href: '/dashboard/home', icon: LayoutDashboard },
        { label: 'Usuários', href: '/dashboard/usuarios', icon: Users },
        escalas,
        trocas,
        { label: 'Relatórios', href: '/dashboard/relatorios', icon: BarChart3 },
        manual,
      ]
    : [escalas, trocas, manual]

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      <Sidebar
        itens={menuItems}
        usuario={{ nome: userData.nome, perfil: labelPerfil(userData.role).replace(/^[^\p{L}]+/u, '') }}
        onSair={handleLogout}
      />

      <div className="ml-24 flex min-h-screen flex-1 flex-col">
      <main className="dashboard-content w-full">
        <DashboardUserProvider value={{ user: userData, userData }}>
          {children}
        </DashboardUserProvider>
      </main>
      </div>
    </div>
  )
}
