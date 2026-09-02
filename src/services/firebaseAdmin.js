import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// ⚠️ VOCÊ PRECISA BAIXAR A CHAVE JSON DO FIREBASE
// Firebase Console → Project Settings → Service Accounts → Generate New Private Key

const serviceAccount = require('../../firebase-key.json') // Salve a chave aqui

const adminApp = initializeApp({
  credential: cert(serviceAccount)
})

export const adminAuth = getAuth(adminApp)

export const deleteUserFromFirebase = async (uid) => {
  try {
    await adminAuth.deleteUser(uid)
    console.log('✅ Usuário deletado do Firebase:', uid)
    return true
  } catch (error) {
    console.error('❌ Erro ao deletar do Firebase:', error)
    throw error
  }
}