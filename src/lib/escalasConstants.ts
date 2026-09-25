// Constantes e helpers puros de exibição/regras de escala, compartilhados
// entre os componentes de Escalas (calendário, lista, modais).

export interface TipoEscala { id: string; label: string; cor: string }

export const TIPOS_ESCALA: TipoEscala[] = [
  { id: 'presencial', label: '🏢 Presencial', cor: '#3498db' },
  { id: 'homeoffice', label: '🏠 Home Office', cor: '#2ecc71' },
  { id: 'sabado', label: '📅 Escala Sábado', cor: '#f39c12' },
  { id: 'sobreaviso', label: '🚨 Sobreaviso', cor: '#e74c3c' },
]

export const TIPO_HIBRIDO = { id: 'hibrido', label: '🏢🏠 Presencial + Home Office', cor: '#8e44ad' }

// "Curso" não é um tipo gravado no banco — é um dia fixo na semana (por
// aprendiz) em que a escala presencial normal é exibida como curso em vez
// disso. Não entra em TIPOS_ESCALA de propósito, pra não aparecer como
// opção ao criar/editar uma escala de verdade.
export const TIPO_CURSO = { id: 'curso', label: '🎓 Curso', cor: '#9b59b6' }

// Perfis tratados como a mesma categoria "jovem/estagiário" pras regras de
// rodízio (nunca home office, nunca sábado, baia exclusiva configurável,
// dia de curso).
export const PERFIS_JOVEM_APRENDIZ: string[] = ['estagiario_aprendiz', 'trainee']

export function ehJovemAprendiz(role: string | null | undefined): boolean {
  return PERFIS_JOVEM_APRENDIZ.includes(role ?? "")
}

// Estag/Aprendiz ou Trainee com dia de curso configurado (diaCurso: 0=domingo..
// 6=sábado) e a data caindo nesse dia da semana → está no curso, não
// presencial. Usa o sinalizador "ehAprendiz" (já calculado a partir do
// perfil no backend) em vez de checar o role aqui de novo.
export function estaEmDiaCurso(
  usuario: { ehAprendiz?: boolean; diaCurso?: number | string | null } | null | undefined,
  data: Date
): boolean {
  if (!usuario || !usuario.ehAprendiz) return false
  if (usuario.diaCurso === null || usuario.diaCurso === undefined || usuario.diaCurso === '') return false
  return data.getDay() === Number(usuario.diaCurso)
}

export const DURACAO_PRESETS: Record<string, Array<{ label: string; value: number }>> = {
  sabado: [{ label: '1 sábado', value: 1 }, { label: '2 sábados', value: 2 }, { label: '4 sábados', value: 4 }],
  padrao: [{ label: '1 dia', value: 1 }, { label: '1 semana', value: 7 }, { label: '15 dias', value: 15 }, { label: '1 mês', value: 30 }],
}
export const HORIZONTE_PRESETS = [{ label: '3 meses', value: 90 }, { label: '6 meses', value: 180 }, { label: '1 ano', value: 365 }]
export const PERCENTUAL_PRESETS = [25, 50, 75]
export const DIAS_SEMANA = [
  { id: 1, label: 'Segunda' },
  { id: 2, label: 'Terça' },
  { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' },
  { id: 5, label: 'Sexta' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
]

// Tipos "reais" gravados no banco — usado ao editar uma escala já existente
// (que pode ter sido criada como Presencial ou Home Office isolados pelo modo híbrido).
export function tiposDisponiveisParaEquipe(equipe: string | null | undefined): TipoEscala[] {
  return TIPOS_ESCALA.filter(t => t.id !== 'sabado' || equipe === 'suporte')
}

// Opções ao GERAR uma escala nova: Presencial e Home Office isolados saem
// da lista porque já estão cobertos pelo modo híbrido (que os combina).
export function tiposGeracaoDisponiveis(equipe: string | null | undefined): TipoEscala[] {
  const base = TIPOS_ESCALA.filter(t =>
    (t.id === 'sabado' && equipe === 'suporte') || t.id === 'sobreaviso'
  )
  return [TIPO_HIBRIDO, ...base]
}

export function addDiasStr(dataStr: string, delta: number): string {
  const [y, m, d] = dataStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function diffDiasStr(inicioStr: string, fimStr: string): number {
  const [y1, m1, d1] = inicioStr.split('-').map(Number)
  const [y2, m2, d2] = fimStr.split('-').map(Number)
  const t1 = new Date(y1, m1 - 1, d1).getTime()
  const t2 = new Date(y2, m2 - 1, d2).getTime()
  return Math.round((t2 - t1) / 86400000) + 1
}

// Sobreaviso sempre aparece primeiro nas listagens de escalas do dia
export function ordenarSobreavisoPrimeiro<T extends { tipo?: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number(b.tipo === 'sobreaviso') - Number(a.tipo === 'sobreaviso'))
}
