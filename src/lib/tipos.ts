// Tipos compartilhados pelos motores de geração de escala (lib/escalas*).

export interface Participante {
  cd_usuario: number | string
  role?: string
  cd_tecnico: number | string
  nm_tecnico: string
  especialidade?: string | null
  horarioEntrada?: string | null
  baiaId?: number | null
  elegivelHomeOffice?: boolean
  feriasInicio?: string | null
  feriasFim?: string | null
}

export interface BlocoEscala {
  dtInicio: string
  dtFim: string
  cdTecnico: number | string
  tecnicoUid?: string
  tecnicoNome?: string
  tipo: string
}

export interface AvisoEscala {
  data: string
  mensagem: string
}

export interface ErroPlano {
  error: string
  status: number
}

export interface PlanoEscala {
  equipeId: number
  equipe: string
  blocos: BlocoEscala[]
  avisos?: AvisoEscala[]
}

export type ResultadoPlano = ErroPlano | PlanoEscala

export interface ArgsPlano {
  role: string
  userEquipe: string | null | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
}
