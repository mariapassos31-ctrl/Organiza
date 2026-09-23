'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAuthUser } from '../../hooks/useAuthUser'
import { DashboardUserProvider } from '../../context/DashboardUserContext'
import { ehPerfilGestao } from '../../lib/equipesConfig'
import '../../styles/Escalas.css'
import '../../styles/Dashboard.css'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const { user, loading } = useAuthUser()
  const [trocasPendentes, setTrocasPendentes] = useState(0)

  const userData = user
    ? {
        uid: user.id,
        nome: user.name,
        email: user.email,
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

  // ✅ MENU DINÂMICO POR PERFIL
  const menuItems = [
    // Admin vê tudo
    ...(userData.role === 'admin' ? [
      { label: '📊 Dashboard', path: '/dashboard/home' },
      { label: '👥 Usuários', path: '/dashboard/usuarios' },
      { label: '📅 Escalas', path: '/dashboard/escalas' },
      { label: '🔄 Trocas', path: '/dashboard/trocas' },
      { label: '📈 Relatórios', path: '/dashboard/relatorios' },
      { label: '📖 Manual de Uso', path: '/dashboard/manual' }
    ] : []),

    // Gestor e Líder veem o mesmo menu: Usuários, Escalas, Trocas, Relatórios
    ...(userData.role === 'gestor' || userData.role === 'lider' ? [
      { label: '📊 Dashboard', path: '/dashboard/home' },
      { label: '👥 Usuários', path: '/dashboard/usuarios' },
      { label: '📅 Escalas', path: '/dashboard/escalas' },
      { label: '🔄 Trocas', path: '/dashboard/trocas' },
      { label: '📈 Relatórios', path: '/dashboard/relatorios' },
      { label: '📖 Manual de Uso', path: '/dashboard/manual' }
    ] : []),

    // Qualquer colaborador (técnico, analista, desenvolvedor, ou perfil livre)
    // vê: Escalas, Trocas (Agenda ficou redundante — Escalas já cobre tudo)
    ...(!ehPerfilGestao(userData.role) ? [
      { label: '📅 Escalas', path: '/dashboard/escalas' },
      { label: '🔄 Trocas', path: '/dashboard/trocas' },
      { label: '📖 Manual de Uso', path: '/dashboard/manual' }
    ] : [])
  ]

  return (
    <div className="dashboard-container">
      {/* SIDEBAR */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>🔧 Escala TI</h2>
          <p className="user-info">
            {userData.nome}<br/>
            <small>{userData.role.toUpperCase()}</small>
          </p>
        </div>

        <nav className="sidebar-menu">
          {menuItems.map(item => (
            <a
              key={item.path}
              href={item.path}
              className="menu-item"
              onClick={(e) => {
                e.preventDefault()
                router.push(item.path)
              }}
            >
              {item.label}
              {item.path === '/dashboard/trocas' && trocasPendentes > 0 && (
                <span className="menu-badge">{trocasPendentes}</span>
              )}
            </a>
          ))}
        </nav>

        <button className="btn-logout" onClick={handleLogout}>
          🚪 Logout
        </button>
      </aside>

      {/* CONTEÚDO */}
      <main className="dashboard-content">
        <DashboardUserProvider value={{ user: userData, userData }}>
          {children}
        </DashboardUserProvider>
      </main>
    </div>
  )
}
