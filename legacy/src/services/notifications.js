import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'

// Criar notificação
export const createNotification = async (notificationData) => {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notificationData,
      read: false,
      createdAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter notificações de um usuário
export const getNotificationsByUser = async (userId, limitCount = 50) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter notificações não lidas
export const getUnreadNotifications = async (userId) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    throw new Error(error.message)
  }
}

// Marcar notificação como lida
export const markNotificationAsRead = async (notificationId) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Marcar todas as notificações como lidas
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const notifications = await getUnreadNotifications(userId)
    
    for (const notification of notifications) {
      await markNotificationAsRead(notification.id)
    }
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar notificação
export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId))
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar todas as notificações de um usuário
export const deleteAllNotifications = async (userId) => {
  try {
    const notifications = await getNotificationsByUser(userId, 1000)
    
    for (const notification of notifications) {
      await deleteNotification(notification.id)
    }
  } catch (error) {
    throw new Error(error.message)
  }
}