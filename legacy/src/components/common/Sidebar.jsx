import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Swap2, 
  AlertCircle,
  Settings,
  X,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'

export const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { sidebarOpen } = useUIStore()

  const isAdmin = user?.role === 'admin'
  const isTechnician = user?.role === 'technician'

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/', show: true },
    { label: 'Técnicos', icon: Users, path: '/admin/technicians', show: isAdmin },
    { label: 'Escalas', icon: Calendar, path: '/admin/schedules', show: isAdmin },
    { label: 'Trocas', icon: Swap2, path: '/admin/swaps', show: isAdmin },
    { label: 'Indisponibilidades', icon: AlertCircle, path: '/admin/unavailability', show: isAdmin },
    { label: 'Minhas Escalas', icon: Calendar, path: '/technician/schedules', show: isTechnician },
    { label: 'Minhas Trocas', icon: Swap2, path: '/technician/swaps', show: isTechnician },
    { label: 'Configurações', icon: Settings, path: '/settings', show: true },
  ]

  const handleNavigate = (path) => {
    navigate(path)
    onClose?.()
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static left-0 top-0 h-screen w-64 bg-gray-900 text-white transform transition-transform duration-300 z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Menu</h2>
          <button onClick={onClose} className="md:hidden">
            <X size={24} />
          </button>
        </div>

        <nav className="space-y-2 px-4">
          {menuItems.map(
            (item) =>
              item.show && (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </button>
              )
          )}
        </nav>
      </aside>
    </>
  )
}