export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export const validatePhone = (phone) => {
  const re = /^(\d{10,11})?$/
  return re.test(phone.replace(/\D/g, ''))
}

export const validatePassword = (password) => {
  return password.length >= 6
}

export const validateTechnicianForm = (data) => {
  const errors = {}

  if (!data.fullName?.trim()) {
    errors.fullName = 'Nome completo é obrigatório'
  }

  if (!data.email?.trim()) {
    errors.email = 'E-mail é obrigatório'
  } else if (!validateEmail(data.email)) {
    errors.email = 'E-mail inválido'
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.phone = 'Telefone inválido'
  }

  if (!data.team?.trim()) {
    errors.team = 'Equipe é obrigatória'
  }

  if (!data.scheduleTypes || data.scheduleTypes.length === 0) {
    errors.scheduleTypes = 'Selecione pelo menos um tipo de escala'
  }

  return errors
}

export const validateScheduleGroupForm = (data) => {
  const errors = {}

  if (!data.name?.trim()) {
    errors.name = 'Nome do grupo é obrigatório'
  }

  if (!data.type) {
    errors.type = 'Tipo de escala é obrigatório'
  }

  if (!data.technicians || data.technicians.length === 0) {
    errors.technicians = 'Selecione pelo menos um técnico'
  }

  return errors
}

export const validateUnavailabilityForm = (data) => {
  const errors = {}

  if (!data.startDate) {
    errors.startDate = 'Data inicial é obrigatória'
  }

  if (!data.endDate) {
    errors.endDate = 'Data final é obrigatória'
  }

  if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
    errors.endDate = 'Data final deve ser após a data inicial'
  }

  return errors
}