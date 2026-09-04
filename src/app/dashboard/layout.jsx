'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAuthUser } from '../../hooks/useAuthUser'
import { DashboardUserProvider } from '../../context/DashboardUserContext'
import '../../styles/Escalas.css'
import '../../styles/Dashboard.css'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const { user, loading } = useAuthUser()

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
      { label: '📆 Agenda', path: '/dashboard/agenda' },
      { label: '📈 Relatórios', path: '/dashboard/relatorios' }
    ] : []),

    // Gestor vê: Usuários, Escalas, Agenda, Relatórios
    ...(userData.role === 'gestor' ? [
      { label: '📊 Dashboard', path: '/dashboard/home' },
      { label: '👥 Usuários', path: '/dashboard/usuarios' },
      { label: '📅 Escalas', path: '/dashboard/escalas' },
      { label: '📆 Agenda', path: '/dashboard/agenda' },
      { label: '📈 Relatórios', path: '/dashboard/relatorios' }
    ] : []),

    // Técnico/Analista vê: Escalas, Agenda
    ...(userData.role === 'tecnico' || userData.role === 'analista' ? [
      { label: '📅 Escalas', path: '/dashboard/escalas' },
      { label: '📆 Agenda', path: '/dashboard/agenda' }
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
