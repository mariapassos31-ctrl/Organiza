import { create } from 'zustand'

export const useScheduleStore = create((set) => ({
  schedules: [],
  groups: [],
  technicians: [],
  loading: false,
  error: null,

  setSchedules: (schedules) => set({ schedules }),
  setGroups: (groups) => set({ groups }),
  setTechnicians: (technicians) => set({ technicians }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  addSchedule: (schedule) => set((state) => ({
    schedules: [...state.schedules, schedule],
  })),
  updateSchedule: (id, updates) => set((state) => ({
    schedules: state.schedules.map(s => s.id === id ? { ...s, ...updates } : s),
  })),
  deleteSchedule: (id) => set((state) => ({
    schedules: state.schedules.filter(s => s.id !== id),
  })),
}))