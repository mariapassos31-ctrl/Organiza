import React from 'react'
import { useNotifications } from '../../hooks/useNotifications'
import { NotificationItem } from './NotificationItem'
import { Loading } from '../common/Loading'
import { X } from 'lucide-react'

export const NotificationCenter = ({ onClose }) => {
  const { notifications, loading, markAsRead } = useNotifications()

  if (loading) return <Loading />

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-bold text-gray-800">Notificações</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={20} />
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          Nenhuma notificação
        </div>
      ) : (
        <div className="divide-y">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={() => markAsRead(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}