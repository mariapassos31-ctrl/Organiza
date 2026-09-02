import { 
  getTechnicianById,
  getActiveTechnicians,
  getTechniciansByScheduleType,
} from './technicians'
import { 
  getScheduleGroupById,
  updateLastAssignedTechnician,
} from './scheduleGroups'
import { 
  isTechnicianUnavailable,
} from './unavailability'

/**
 * ALGORITMO DE RODÍZIO AUTOMÁTICO
 * 
 * Lógica:
 * 1. Obter grupo de escala
 * 2. Obter lista de técnicos ativos
 * 3. Encontrar próximo técnico na ordem de rodízio
 * 4. Verificar indisponibilidade
 * 5. Se indisponível, pular para próximo
 * 6. Retornar técnico disponível
 */

// Encontrar próximo técnico no rodízio
export const findNextTechnician = async (groupId, scheduleDate) => {
  try {
    // 1. Obter grupo
    const group = await getScheduleGroupById(groupId)
    if (!group) throw new Error('Grupo de escala não encontrado')

    // 2. Obter ordem de rodízio
    const rotationOrder = group.rotationOrder || group.technicians || []
    if (rotationOrder.length === 0) {
      throw new Error('Nenhum técnico disponível no grupo')
    }

    // 3. Obter último técnico escalado
    const lastAssignedId = group.lastAssignedTechnician
    let currentIndex = rotationOrder.indexOf(lastAssignedId)
    
    // Se não encontrou ou é -1, começa do 0
    if (currentIndex === -1) {
      currentIndex = -1
    }

    // 4. Procurar próximo técnico disponível
    let attempts = 0
    const maxAttempts = rotationOrder.length

    while (attempts < maxAttempts) {
      currentIndex = (currentIndex + 1) % rotationOrder.length
      const technicianId = rotationOrder[currentIndex]

      // Verificar se técnico existe e está ativo
      const technician = await getTechnicianById(technicianId)
      if (!technician || !technician.active) {
        attempts++
        continue
      }

      // Verificar indisponibilidade
      const isUnavailable = await isTechnicianUnavailable(technicianId, scheduleDate)
      if (!isUnavailable) {
        return {
          technicianId,
          technician,
          nextIndex: currentIndex,
        }
      }

      attempts++
    }

    // Se todos estão indisponíveis, retornar o último escalado com aviso
    if (lastAssignedId) {
      const lastTechnician = await getTechnicianById(lastAssignedId)
      if (lastTechnician) {
        return {
          technicianId: lastAssignedId,
          technician: lastTechnician,
          warning: 'Todos os técnicos estão indisponíveis. Usando último escalado.',
        }
      }
    }

    throw new Error('Nenhum técnico disponível para escalar')
  } catch (error) {
    throw new Error(`Erro ao encontrar próximo técnico: ${error.message}`)
  }
}

// Gerar escala automática para um período
export const generateSchedulesForPeriod = async (
  groupId,
  startDate,
  endDate,
  scheduleType,
  dateGenerator // função que gera as datas (sábados, semanas, etc)
) => {
  try {
    const schedulesToCreate = []
    const dates = dateGenerator(startDate, endDate)

    for (const date of dates) {
      const result = await findNextTechnician(groupId, date)
      
      schedulesToCreate.push({
        groupId,
        technicianId: result.technicianId,
        startDate: date,
        endDate: date,
        type: scheduleType,
        isManuallyAssigned: false,
      })

      // Atualizar último técnico escalado
      await updateLastAssignedTechnician(groupId, result.technicianId)
    }

    return schedulesToCreate
  } catch (error) {
    throw new Error(`Erro ao gerar escalas: ${error.message}`)
  }
}

// Validar se uma alteração manual deve impactar o rodízio
export const shouldUpdateRotationAfterManualChange = async (
  groupId,
  newTechnicianId,
  scheduleDate
) => {
  try {
    const group = await getScheduleGroupById(groupId)
    const rotationOrder = group.rotationOrder || group.technicians || []
    
    // Verificar se o novo técnico está na ordem de rodízio
    const isInRotation = rotationOrder.includes(newTechnicianId)
    
    return {
      shouldUpdate: isInRotation,
      message: isInRotation 
        ? 'Técnico está na ordem de rodízio. Próxima escala será afetada.'
        : 'Técnico não está na ordem de rodízio. Próxima escala não será afetada.',
    }
  } catch (error) {
    throw new Error(`Erro ao validar impacto no rodízio: ${error.message}`)
  }
}