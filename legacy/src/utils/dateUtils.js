import { 
  format, 
  parse, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isSaturday,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  isToday,
  isBefore,
  isAfter,
  isSameDay,
  addDays,
  addMonths,
  addWeeks,
  differenceInDays,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const formatDate = (date, formatStr = 'dd/MM/yyyy') => {
  return format(new Date(date), formatStr, { locale: ptBR })
}

export const formatDateLong = (date) => {
  return format(new Date(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export const formatDateShort = (date) => {
  return format(new Date(date), 'dd/MM', { locale: ptBR })
}

export const formatMonth = (date) => {
  return format(new Date(date), "MMMM 'de' yyyy", { locale: ptBR })
}

export const formatWeek = (startDate, endDate) => {
  return `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
}

export const getSaturdaysOfMonth = (date) => {
  const start = startOfMonth(new Date(date))
  const end = endOfMonth(new Date(date))
  const allDays = eachDayOfInterval({ start, end })
  return allDays.filter(day => isSaturday(day))
}

export const getWeeksOfMonth = (date) => {
  const start = startOfMonth(new Date(date))
  const end = endOfMonth(new Date(date))
  const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
  return weeks.map(weekStart => ({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  }))
}

export const isDateToday = (date) => {
  return isToday(new Date(date))
}

export const isDateInRange = (date, startDate, endDate) => {
  const d = new Date(date)
  const s = new Date(startDate)
  const e = new Date(endDate)
  return !isBefore(d, s) && !isAfter(d, e)
}

export const isSameDateDay = (date1, date2) => {
  return isSameDay(new Date(date1), new Date(date2))
}

export const getNextSaturday = (fromDate = new Date()) => {
  let date = new Date(fromDate)
  while (!isSaturday(date)) {
    date = addDays(date, 1)
  }
  return date
}

export const getNextMonday = (fromDate = new Date()) => {
  let date = new Date(fromDate)
  const dayOfWeek = date.getDay()
  const daysUntilMonday = (1 - dayOfWeek + 7) % 7 || 7
  return addDays(date, daysUntilMonday)
}

export const getDayName = (date) => {
  return format(new Date(date), 'EEEE', { locale: ptBR })
}

export const getMonthName = (date) => {
  return format(new Date(date), 'MMMM', { locale: ptBR })
}

export const getDateDifference = (date1, date2) => {
  return differenceInDays(new Date(date1), new Date(date2))
}

export const addDaysToDate = (date, days) => {
  return addDays(new Date(date), days)
}

export const addMonthsToDate = (date, months) => {
  return addMonths(new Date(date), months)
}

export const addWeeksToDate = (date, weeks) => {
  return addWeeks(new Date(date), weeks)
}

export const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(new Date(date).getFullYear(), new Date(date).getMonth(), new Date(date).getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}