import { useState, useEffect } from 'react'
import { getNotificationsByUser, markNotificationAsRead } from '../services/notifications'
import { useAuthStore } from '../store/authStore'

export const useNotifications = () => {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user?.uid) return

    const fetchNotifications = async () => {
      try {
        const data = await getNotificationsByUser(user.uid)
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.read).length)
      } catch (err) {
        console.error('Erro ao buscar notificações:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
  }, [user?.uid])

  const markAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Erro ao marcar como lido:', err)
    }
  }

  return { notifications, loading, unreadCount, markAsRead }
}