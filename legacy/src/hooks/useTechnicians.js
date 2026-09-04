import { useState, useEffect } from 'react'
import { getAllTechnicians, getActiveTechnicians } from '../services/technicians'

export const useTechnicians = (activeOnly = false) => {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        setLoading(true)
        const data = activeOnly 
          ? await getActiveTechnicians()
          : await getAllTechnicians()
        setTechnicians(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTechnicians()
  }, [activeOnly])

  return { technicians, loading, error }
}