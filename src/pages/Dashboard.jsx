
import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { auth } from '../services/firebase'
import '../styles/Escalas.css'

import ProtectedRoute from '../components/ProtectedRoute'
import Usuarios from './Usuarios'
import Escalas from './Escalas'
import MinhaAgenda from './MinhaAgenda'
import Relatorios from './Relatorios'
import '../styles/Dashboard.css'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const currentUser = auth.currentUser
    setUser(currentUser)

    if (currentUser) {
      const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]')
      const usuarioEncontrado = usuarios.find(u => u.uid === currentUser.uid)
      if (usuarioEncontrado) {
        setUserData(usuarioEncontrado)
      }
    }
    setLoading(false)
  }, [])

  const handleLogout = async () => {
    try {
      await auth.signOut()
      navigate('/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (!user || !userData) {
    return <Navigate to="/login" />
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
    {/* NOTIFICAÇÕES DE TROCA */}

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
                navigate(item.path)
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
        <Routes>
  {/* HOME */}
  <Route path="home" element={<div className="page-home"><h1>Bem-vindo, {userData.nome}!</h1></div>} />

  {/* USUÁRIOS - Apenas Admin e Gestor */}
  <Route
    path="usuarios"
    element={
      <ProtectedRoute requiredRoles={['admin', 'gestor']} userData={userData}>
        <Usuarios />
      </ProtectedRoute>
    }
  />

  {/* ESCALAS - Admin, Gestor, Técnico, Analista */}
  <Route
    path="escalas"
    element={
      <ProtectedRoute requiredRoles={['admin', 'gestor', 'tecnico', 'analista']} userData={userData}>
        <Escalas />
      </ProtectedRoute>
    }
  />

  {/* AGENDA - Admin, Gestor, Técnico, Analista */}
  <Route
    path="agenda"
    element={
      <ProtectedRoute requiredRoles={['admin', 'gestor', 'tecnico', 'analista']} userData={userData}>
        <MinhaAgenda/>
      </ProtectedRoute>
    }
  />

  {/* RELATÓRIOS - Apenas Admin e Gestor */}
  <Route
    path="relatorios"
    element={
      <ProtectedRoute requiredRoles={['admin', 'gestor']} userData={userData}>
        <Relatorios />
      </ProtectedRoute>
    }
  />

  {/* FALLBACK */}
  <Route path="*" element={<Navigate to="home" />} />
</Routes>
      </main>
    </div>
  )
}