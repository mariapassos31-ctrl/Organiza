import React from 'react'
import { formatDate, formatDateLong } from '../../utils/dateUtils'
import { SCHEDULE_TYPE_LABELS } from '../../utils/constants'
import { Card } from '../common/Card'
import { Calendar, User } from 'lucide-react'

export const ScheduleCard = ({ schedule, technician, onEdit, onDelete }) => {
  const startDate = schedule.startDate?.toDate?.() || new Date(schedule.startDate)
  const endDate = schedule.endDate?.toDate?.() || new Date(schedule.endDate)

  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">
            {SCHEDULE_TYPE_LABELS[schedule.type] || schedule.type}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {formatDateLong(startDate)}
          </p>
        </div>
        {schedule.isManuallyAssigned && (
          <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">
            Manual
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
        <User size={20} className="text-blue-600" />
        <div>
          <p className="text-sm text-gray-600">Responsável</p>
          <p className="font-semibold text-gray-800">{technician?.fullName || 'Desconhecido'}</p>
        </div>
      </div>

      {technician?.email && (
        <p className="text-sm text-gray-600 mb-4">
          📧 {technician.email}
        </p>
      )}

      <div className="flex gap-2">
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            Editar
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
          >
            Deletar
          </button>
        )}
      </div>
    </Card>
  )
}