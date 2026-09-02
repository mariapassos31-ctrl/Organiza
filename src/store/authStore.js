import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  error: null,

  setUser: (user) => {
    set({ user, loading: false })
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  logout: () => {
    set({ user: null, error: null, loading: false })
  },
}))