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
} from 'firebase/firestore'
import { db } from './firebase'

// Criar indisponibilidade
export const createUnavailability = async (unavailabilityData) => {
  try {
    const docRef = await addDoc(collection(db, 'unavailability'), {
      ...unavailabilityData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter indisponibilidades de um técnico
export const getUnavailabilityByTechnician = async (technicianId) => {
  try {
    const q = query(
      collection(db, 'unavailability'),
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

// Obter todas as indisponibilidades
export const getAllUnavailability = async () => {
  try {
    const q = query(
      collection(db, 'unavailability'),
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

// Verificar se técnico está indisponível em uma data
export const isTechnicianUnavailable = async (technicianId, date) => {
  try {
    const unavailabilities = await getUnavailabilityByTechnician(technicianId)
    const checkDate = new Date(date)

    return unavailabilities.some(unavail => {
      const startDate = new Date(unavail.startDate.toDate())
      const endDate = new Date(unavail.endDate.toDate())
      return checkDate >= startDate && checkDate <= endDate
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Atualizar indisponibilidade
export const updateUnavailability = async (unavailabilityId, updates) => {
  try {
    await updateDoc(doc(db, 'unavailability', unavailabilityId), {
      ...updates,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar indisponibilidade
export const deleteUnavailability = async (unavailabilityId) => {
  try {
    await deleteDoc(doc(db, 'unavailability', unavailabilityId))
  } catch (error) {
    throw new Error(error.message)
  }
}