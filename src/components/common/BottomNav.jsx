import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Calendar, 
  Swap2, 
  User,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  const isTechnician = user?.role === 'technician'

  const items = [
    { icon: LayoutDashboard, label: 'Home', path: '/' },
    { icon: Calendar, label: 'Escalas', path: isTechnician ? '/technician/schedules' : '/admin/schedules' },
    { icon: Swap2, label: 'Trocas', path: isTechnician ? '/technician/swaps' : '/admin/swaps' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-40 safe-bottom">
      <div className="flex items-center justify-around">
        {items.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 flex flex-col items-center justify-center py-3 transition-colors ${
              location.pathname === item.path
                ? 'text-blue-600 border-t-2 border-blue-600'
                : 'text-gray-600'
            }`}
          >
            <item.icon size={24} />
            <span className="text-xs mt-1">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}