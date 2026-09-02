import { useState, useEffect } from 'react'
import { getAllSchedules, getSchedulesByGroup, getSchedulesByTechnician } from '../services/schedules'

export const useSchedules = (groupId = null, technicianId = null) => {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoading(true)
        let data
        if (groupId) {
          data = await getSchedulesByGroup(groupId)
        } else if (technicianId) {
          data = await getSchedulesByTechnician(technicianId)
        } else {
          data = await getAllSchedules()
        }
        setSchedules(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSchedules()
  }, [groupId, technicianId])

  return { schedules, loading, error }
}