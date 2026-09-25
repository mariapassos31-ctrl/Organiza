// Formas dos dados devolvidos pelas rotas de API (src/app/api/*), já no
// formato que o front usa.

export interface UsuarioLogado {
  uid: string
  nome: string
  email: string
  role: string
  equipe: string | null
}

export interface Usuario {
  uid: string
  nome: string
  email: string
  role: string
  equipe: string | null
  matricula: string
  especialidade: string
  horarioEntrada: string
  baia: string
  baiaFixa: boolean
  elegivelHomeOffice: boolean
  ehSupervisor: boolean
  ehAprendiz: boolean
  diaCurso: number | null
  feriasInicio: string
  feriasFim: string
  ativo: boolean
  criadoEm: string
}

export interface Escala {
  id: string
  tipo: string
  dataInicio: string
  dataFim: string
  tecnicos: string[]
  equipe: string | null
  descricao: string | null
  status: string
  criadoPor: string | null
  dataCriacao: string
  salaId: number | null
}

export interface Troca {
  id: string
  status: string
  dia: string | null
  escalaId: string
  escalaTipo: string
  escalaDataInicio: string
  escalaDataFim: string
  equipe: string | null
  solicitanteUid: string
  solicitanteNome: string
  destinoUid: string | null
  destinoNome: string | null
  dataCriacao: string
  dataAceite: string | null
  escalaSolicitadaId: string | null
  escalaSolicitadaTipo: string | null
  escalaSolicitadaDataInicio: string | null
  escalaSolicitadaDataFim: string | null
}

export interface ConfigBaia {
  equipe?: string
  especialidade?: string
  perfil?: string
}

export interface PosicaoBaia {
  top: string
  left: string
}

export type TipoMarcador = 'divisoria' | 'rack' | 'impressora' | 'outro'

export interface MarcadorSala {
  id: string
  tipo: TipoMarcador
  rotulo: string
  top: string
  left: string
}

export interface GrupoRodizio {
  id: number
  nome: string
  salaIds: number[]
}

export interface GrupoRodizioDetalhado {
  id: number
  nome: string
  salas: { id: number; nome: string }[]
  equipes: string[]
}

export interface Sala {
  id: number
  nome: string
  imagem: string | null
  imagemHash: string | null
  qtdBaias: number
  equipes: string[]
  modoReserva: 'equipe' | 'perfil' | 'entre_salas'
  podeEditar: boolean
  baias: Record<string, ConfigBaia>
  posicoes: Record<string, PosicaoBaia>
  marcadores: MarcadorSala[]
  grupoRodizio: GrupoRodizio | null
}

export interface ConfigLab {
  responsavelUid: string | null
  backupUid: string | null
}

export interface OcupanteAprendiz {
  nome: string
  turno?: string | null
}

// Campos editáveis de uma escala no formulário de edição.
export type FormEscala = Pick<Escala, 'tipo' | 'dataInicio' | 'dataFim' | 'tecnicos' | 'equipe' | 'descricao' | 'status' | 'salaId'>

export interface DiaDetalhado {
  data: Date
  escalas: Escala[]
}

// Item devolvido por /api/tecnicos.
export interface TecnicoResumo {
  id: string
  nome: string
  email: string
  telefone: string
  especialidade: string | null
  matricula: string
  disponivel: boolean
  equipe: string | null
  horarioEntrada: string
  baia: string
  baiaFixa: boolean
  elegivelHomeOffice: boolean
  diaCurso: number | null
  feriasInicio: string
  feriasFim: string
}
