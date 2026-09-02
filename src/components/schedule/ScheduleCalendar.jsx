import React, { useState } from 'react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '../common/Card'

export const ScheduleCalendar = ({ schedules = [], onDateClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getSchedulesForDate = (date) => {
    return schedules.filter(schedule => {
      const scheduleDate = schedule.startDate?.toDate?.() || new Date(schedule.startDate)
      return format(scheduleDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    })
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-800">
          {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDays.map(day => (
          <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {daysInMonth.map(day => {
          const daySchedules = getSchedulesForDate(day)
          const isCurrentMonth = isSameMonth(day, currentDate)
          const isTodayDate = isToday(day)

          return (
            <button
              key={format(day, 'yyyy-MM-dd')}
              onClick={() => onDateClick?.(day)}
              className={`aspect-square p-2 rounded-lg text-sm font-semibold transition-colors ${
                !isCurrentMonth ? 'text-gray-300 bg-gray-50' : ''
              } ${
                isTodayDate ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              <div className="text-center">
                <div>{format(day, 'd')}</div>
                {daySchedules.length > 0 && (
                  <div className="text-xs mt-1 bg-red-500 text-white rounded px-1">
                    {daySchedules.length}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}