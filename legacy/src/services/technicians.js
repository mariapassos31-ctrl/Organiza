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

// Criar técnico
export const createTechnician = async (technicianData) => {
  try {
    const docRef = await addDoc(collection(db, 'technicians'), {
      ...technicianData,
      active: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter todos os técnicos
export const getAllTechnicians = async () => {
  try {
    const q = query(
      collection(db, 'technicians'),
      orderBy('fullName', 'asc')
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

// Obter técnicos ativos
export const getActiveTechnicians = async () => {
  try {
    const q = query(
      collection(db, 'technicians'),
      where('active', '==', true),
      orderBy('fullName', 'asc')
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

// Obter técnico por ID
export const getTechnicianById = async (technicianId) => {
  try {
    const docSnap = await getDoc(doc(db, 'technicians', technicianId))
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter técnico por userId
export const getTechnicianByUserId = async (userId) => {
  try {
    const q = query(
      collection(db, 'technicians'),
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.length > 0 
      ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
      : null
  } catch (error) {
    throw new Error(error.message)
  }
}

// Atualizar técnico
export const updateTechnician = async (technicianId, updates) => {
  try {
    await updateDoc(doc(db, 'technicians', technicianId), {
      ...updates,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Ativar/Desativar técnico
export const toggleTechnicianStatus = async (technicianId, active) => {
  try {
    await updateDoc(doc(db, 'technicians', technicianId), {
      active,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar técnico
export const deleteTechnician = async (technicianId) => {
  try {
    await deleteDoc(doc(db, 'technicians', technicianId))
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter técnicos por tipo de escala
export const getTechniciansByScheduleType = async (scheduleType) => {
  try {
    const q = query(
      collection(db, 'technicians'),
      where('scheduleTypes', 'array-contains', scheduleType),
      where('active', '==', true),
      orderBy('fullName', 'asc')
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