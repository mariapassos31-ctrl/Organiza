export const SCHEDULE_TYPES = {
  SATURDAY: 'saturday',
  HOMEOFFICE: 'homeoffice',
  ONCALL_SYSTEMS: 'oncall_systems',
  ONCALL_INFRA: 'oncall_infra',
}

export const SCHEDULE_TYPE_LABELS = {
  saturday: 'Escala de Sábado',
  homeoffice: 'Home Office',
  oncall_systems: 'Sobreaviso Sistemas',
  oncall_infra: 'Sobreaviso Infraestrutura',
}

export const USER_ROLES = {
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  VIEWER: 'viewer',
}

export const SWAP_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

export const SWAP_STATUS_LABELS = {
  pending: 'Pendente',
  accepted: 'Aceita',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
}

export const NOTIFICATION_TYPES = {
  SCHEDULE_ASSIGNED: 'schedule_assigned',
  SWAP_REQUESTED: 'swap_requested',
  SWAP_ACCEPTED: 'swap_accepted',
  SWAP_REJECTED: 'swap_rejected',
  UNAVAILABILITY_CREATED: 'unavailability_created',
}

export const FREQUENCY = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
}

export const TEAMS = [
  'Suporte Técnico',
  'Infraestrutura',
  'Sistemas',
  'Redes',
  'Banco de Dados',
  'Segurança',
]