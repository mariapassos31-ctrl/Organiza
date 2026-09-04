import React from 'react'
import { ScheduleCard } from './ScheduleCard'
import { Loading } from '../common/Loading'

export const ScheduleList = ({ schedules, technicians, loading, onEdit, onDelete }) => {
  if (loading) return <Loading />

  if (!schedules || schedules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Nenhuma escala encontrada</p>
      </div>
    )
  }

  return (
    <div>
      {schedules.map(schedule => {
        const technician = technicians?.find(t => t.id === schedule.technicianId)
        return (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            technician={technician}
            onEdit={() => onEdit?.(schedule)}
            onDelete={() => onDelete?.(schedule.id)}
          />
        )
      })}
    </div>
  )
}