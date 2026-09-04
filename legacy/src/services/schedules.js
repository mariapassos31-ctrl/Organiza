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
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

// Criar escala
export const createSchedule = async (scheduleData) => {
  try {
    const docRef = await addDoc(collection(db, 'schedules'), {
      ...scheduleData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    throw new Error(error.message)
  }
}

// Criar múltiplas escalas em batch
export const createSchedulesBatch = async (schedulesData) => {
  try {
    const batch = writeBatch(db)
    const ids = []

    schedulesData.forEach(data => {
      const docRef = doc(collection(db, 'schedules'))
      batch.set(docRef, {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      ids.push(docRef.id)
    })

    await batch.commit()
    return ids
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter todas as escalas
export const getAllSchedules = async () => {
  try {
    const q = query(
      collection(db, 'schedules'),
      orderBy('startDate', 'asc')
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

// Obter escalas por grupo
export const getSchedulesByGroup = async (groupId) => {
  try {
    const q = query(
      collection(db, 'schedules'),
      where('groupId', '==', groupId),
      orderBy('startDate', 'asc')
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

// Obter escalas por técnico
export const getSchedulesByTechnician = async (technicianId) => {
  try {
    const q = query(
      collection(db, 'schedules'),
      where('technicianId', '==', technicianId),
      orderBy('startDate', 'asc')
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

// Obter escalas por período
export const getSchedulesByDateRange = async (startDate, endDate) => {
  try {
    const q = query(
      collection(db, 'schedules'),
      where('startDate', '>=', Timestamp.fromDate(new Date(startDate))),
      where('startDate', '<=', Timestamp.fromDate(new Date(endDate))),
      orderBy('startDate', 'asc')
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

// Obter escala por ID
export const getScheduleById = async (scheduleId) => {
  try {
    const docSnap = await getDoc(doc(db, 'schedules', scheduleId))
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
  } catch (error) {
    throw new Error(error.message)
  }
}

// Atualizar escala
export const updateSchedule = async (scheduleId, updates) => {
  try {
    await updateDoc(doc(db, 'schedules', scheduleId), {
      ...updates,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar escala
export const deleteSchedule = async (scheduleId) => {
  try {
    await deleteDoc(doc(db, 'schedules', scheduleId))
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar escalas por grupo
export const deleteSchedulesByGroup = async (groupId) => {
  try {
    const schedules = await getSchedulesByGroup(groupId)
    const batch = writeBatch(db)

    schedules.forEach(schedule => {
      batch.delete(doc(db, 'schedules', schedule.id))
    })

    await batch.commit()
  } catch (error) {
    throw new Error(error.message)
  }
}