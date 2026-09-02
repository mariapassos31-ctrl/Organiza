import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import { auth } from './firebase'

export const registerUser = async (email, password, displayName) => {
  try {
    console.log('🔐 Criando usuário no Firebase...')
    
    // Criar no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user
    console.log('✅ Usuário criado no Firebase:', user.uid)

    // Atualizar perfil
    await updateProfile(user, { displayName })
    console.log('✅ Perfil atualizado')

    // Salvar no localStorage IMEDIATAMENTE
    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]')
    const novoUsuario = {
      uid: user.uid,
      nome: displayName,
      email: email,
      criadoEm: new Date().toISOString(),
      role: 'tecnico',
      equipe: 'suporte',
      isGestor: false
    }
    usuarios.push(novoUsuario)
    localStorage.setItem('usuarios', JSON.stringify(usuarios))
    console.log('✅ Usuário salvo no localStorage')

    return user

  } catch (error) {
    console.error('❌ Erro Firebase:', error.code, error.message)
    
    // MAPEAR ERROS DO FIREBASE
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('email-already-in-use')
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('invalid-email')
    } else if (error.code === 'auth/weak-password') {
      throw new Error('weak-password')
    } else {
      throw new Error(error.message)
    }
  }
}

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user
  } catch (error) {
    throw new Error(error.message)
  }
}

export const logoutUser = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    throw new Error(error.message)
  }
}