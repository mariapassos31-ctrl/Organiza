import React from 'react'
import { Menu, Bell, LogOut, User } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useNotifications } from '../../hooks/useNotifications'
import { logoutUser } from '../../services/auth'

export const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore()
  const { toggleSidebar } = useUIStore()
  const { unreadCount } = useNotifications()

  const handleLogout = async () => {
    try {
      await logoutUser()
      logout()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  return (
    <header className="bg-white shadow-md sticky top-0 z-40">
      <div className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              toggleSidebar()
              onMenuClick?.()
            }}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-2xl font-bold text-blue-600">Escala TI</h1>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-gray-100 rounded-lg">
            <Bell size={24} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          <div className="hidden md:flex items-center gap-3 pl-4 border-l">
            <div className="text-right">
              <p className="font-semibold text-gray-800">{user?.displayName || 'Usuário'}</p>
              <p className="text-xs text-gray-500">{user?.role || 'viewer'}</p>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <User size={20} />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>
    </header>
  )
}