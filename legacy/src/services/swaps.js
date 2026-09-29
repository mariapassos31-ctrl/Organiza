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

// Criar solicitação de troca
export const createSwapRequest = async (swapData) => {
  try {
    const docRef = await addDoc(collection(db, 'swapRequests'), {
      ...swapData,
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    throw new Error(error.message)
  }
}

// Obter solicitações de troca pendentes
export const getPendingSwapRequests = async () => {
  try {
    const q = query(
      collection(db, 'swapRequests'),
      where('status', '==', 'pending'),
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

// Obter trocas de um técnico
export const getSwapsByTechnician = async (technicianId) => {
  try {
    const q = query(
      collection(db, 'swapRequests'),
      where('requestedBy', '==', technicianId),
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

// Obter trocas recebidas por um técnico
export const getSwapsReceivedByTechnician = async (technicianId) => {
  try {
    const q = query(
      collection(db, 'swapRequests'),
      where('targetTechnician', '==', technicianId),
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

// Obter solicitação de troca por ID
export const getSwapRequestById = async (swapId) => {
  try {
    const docSnap = await getDoc(doc(db, 'swapRequests', swapId))
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null
  } catch (error) {
    throw new Error(error.message)
  }
}

// Atualizar status da troca
export const updateSwapRequestStatus = async (swapId, status, additionalData = {}) => {
  try {
    await updateDoc(doc(db, 'swapRequests', swapId), {
      status,
      ...additionalData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Aceitar troca
export const acceptSwapRequest = async (swapId, acceptedBy) => {
  try {
    await updateSwapRequestStatus(swapId, 'accepted', {
      acceptedBy,
      acceptedAt: Timestamp.now(),
    })
  } catch (error) {
    throw new Error(error.message)
  }
}

// Rejeitar troca
export const rejectSwapRequest = async (swapId) => {
  try {
    await updateSwapRequestStatus(swapId, 'rejected')
  } catch (error) {
    throw new Error(error.message)
  }
}

// Cancelar troca
export const cancelSwapRequest = async (swapId) => {
  try {
    await updateSwapRequestStatus(swapId, 'cancelled')
  } catch (error) {
    throw new Error(error.message)
  }
}

// Deletar solicitação de troca
export const deleteSwapRequest = async (swapId) => {
  try {
    await deleteDoc(doc(db, 'swapRequests', swapId))
  } catch (error) {
    throw new Error(error.message)
  }
}