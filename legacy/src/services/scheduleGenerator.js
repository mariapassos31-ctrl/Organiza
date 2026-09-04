import { 
  getSaturdaysOfMonth,
  getWeeksOfMonth,
  addMonthsToDate,
  addWeeksToDate,
} from '../utils/dateUtils'
import { generateSchedulesForPeriod } from './rotationAlgorithm'
import { createSchedulesBatch } from './schedules'
import { SCHEDULE_TYPES } from '../utils/constants'

// Gerar escalas de sábado
export const generateSaturdaySchedules = async (groupId, startDate, monthsCount = 1) => {
  try {
    const schedulesToCreate = []
    let currentDate = new Date(startDate)

    for (let i = 0; i < monthsCount; i++) {
      const saturdays = getSaturdaysOfMonth(currentDate)
      
      for (const saturday of saturdays) {
        const result = await findNextTechnician(groupId, saturday)
        
        schedulesToCreate.push({
          groupId,
          technicianId: result.technicianId,
          startDate: saturday,
          endDate: saturday,
          type: SCHEDULE_TYPES.SATURDAY,
          isManuallyAssigned: false,
        })

        // Atualizar último técnico escalado
        await updateLastAssignedTechnician(groupId, result.technicianId)
      }

      currentDate = addMonthsToDate(currentDate, 1)
    }

    // Criar todas as escalas em batch
    const ids = await createSchedulesBatch(schedulesToCreate)
    return ids
  } catch (error) {
    throw new Error(`Erro ao gerar escalas de sábado: ${error.message}`)
  }
}

// Gerar escalas de home office
export const generateHomeOfficeSchedules = async (groupId, startDate, weeksCount = 4) => {
  try {
    const schedulesToCreate = []
    let currentDate = new Date(startDate)

    for (let i = 0; i < weeksCount; i++) {
      const weekStart = currentDate
      const weekEnd = addWeeksToDate(currentDate, 1)

      const result = await findNextTechnician(groupId, weekStart)
      
      schedulesToCreate.push({
        groupId,
        technicianId: result.technicianId,
        startDate: weekStart,
        endDate: weekEnd,
        type: SCHEDULE_TYPES.HOMEOFFICE,
        isManuallyAssigned: false,
      })

      // Atualizar último técnico escalado
      await updateLastAssignedTechnician(groupId, result.technicianId)

      currentDate = addWeeksToDate(currentDate, 1)
    }

    // Criar todas as escalas em batch
    const ids = await createSchedulesBatch(schedulesToCreate)
    return ids
  } catch (error) {
    throw new Error(`Erro ao gerar escalas de home office: ${error.message}`)
  }
}

// Gerar escalas de sobreaviso
export const generateOncallSchedules = async (groupId, startDate, weeksCount = 4, oncallType) => {
  try {
    const schedulesToCreate = []
    let currentDate = new Date(startDate)

    for (let i = 0; i < weeksCount; i++) {
      const weekStart = currentDate
      const weekEnd = addWeeksToDate(currentDate, 1)

      const result = await findNextTechnician(groupId, weekStart)
      
      schedulesToCreate.push({
        groupId,
        technicianId: result.technicianId,
        startDate: weekStart,
        endDate: weekEnd,
        type: oncallType,
        isManuallyAssigned: false,
      })

      // Atualizar último técnico escalado
      await updateLastAssignedTechnician(groupId, result.technicianId)

      currentDate = addWeeksToDate(currentDate, 1)
    }

    // Criar todas as escalas em batch
    const ids = await createSchedulesBatch(schedulesToCreate)
    return ids
  } catch (error) {
    throw new Error(`Erro ao gerar escalas de sobreaviso: ${error.message}`)
  }
}

// Importar função necessária
import { findNextTechnician } from './rotationAlgorithm'
import { updateLastAssignedTechnician } from './scheduleGroups'
