import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// Registrar alteração no histórico
export const recordScheduleHistory = async (historyData) => {
  try {
    const docRef = await addDoc(collection(db, 'scheduleHistory'), {
      ...historyData,
      changedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter histórico de uma escala
export const getScheduleHistory = async (scheduleId) => {
  try {
    const q = query(
      collection(db, 'scheduleHistory'),
      where('scheduleId', '==', scheduleId),
      orderBy('changedAt', 'desc')
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

// Obter histórico de um técnico
export const getTechnicianHistory = async (technicianId) => {
  try {
    const q = query(
      collection(db, 'scheduleHistory'),
      where('originalTechnicianId', '==', technicianId),
      orderBy('changedAt', 'desc')
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

// Obter histórico por tipo de alteração
export const getHistoryByChangeType = async (changeType) => {
  try {
    const q = query(
      collection(db, 'scheduleHistory'),
      where('changeType', '==', changeType),
      orderBy('changedAt', 'desc')
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