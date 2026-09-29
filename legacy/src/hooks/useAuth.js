import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'
import { getUserData } from '../services/auth'
import { useAuthStore } from '../store/authStore'

export const useAuth = () => {
  const { user, setUser, setLoading, logout } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await getUserData(firebaseUser.uid)
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          ...userData,
        })
      } else {
        logout()
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setLoading, logout])

  return user
}