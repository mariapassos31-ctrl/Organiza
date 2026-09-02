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

// Criar grupo de escala
export const createScheduleGroup = async (groupData) => {
  try {
    const docRef = await addDoc(collection(db, 'scheduleGroups'), {
      ...groupData,
      active: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter todos os grupos
export const getAllScheduleGroups = async () => {
  try {
    const q = query(
      collection(db, 'scheduleGroups'),
      orderBy('name', 'asc')
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

// Obter grupos ativos
export const getActiveScheduleGroups = async () => {
  try {
    const q = query(
      collection(db, 'scheduleGroups'),
      where('active', '==', true),
      orderBy('name', 'asc')
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

// Obter grupo por ID
export const getScheduleGroupById = async (groupId) => {
  try {
    const docSnap = await getDoc(doc(db, 'scheduleGroups', groupId))
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter grupos por tipo
export const getScheduleGroupsByType = async (type) => {
  try {
    const q = query(
      collection(db, 'scheduleGroups'),
      where('type', '==', type),
      where('active', '==', true)
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

// Atualizar grupo
export const updateScheduleGroup = async (groupId, updates) => {
  try {
    await updateDoc(doc(db, 'scheduleGroups', groupId), {
      ...updates,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Atualizar último técnico escalado
export const updateLastAssignedTechnician = async (groupId, technicianId) => {
  try {
    await updateDoc(doc(db, 'scheduleGroups', groupId), {
      lastAssignedTechnician: technicianId,
      lastAssignedDate: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar grupo
export const deleteScheduleGroup = async (groupId) => {
  try {
    await deleteDoc(doc(db, 'scheduleGroups', groupId))
  } catch (error) {
    throw new Error(error.message)
  }
}