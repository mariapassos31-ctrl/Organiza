import type { PoolClient } from 'pg'
import { addDays } from './escalasRodizio'

// Tipos de escala que ocupam uma presença física (baia ou "em casa
// trabalhando") — mutuamente exclusivos pro mesmo técnico no mesmo dia.
// Sobreaviso fica de fora: não ocupa nenhum lugar físico, então não colide
// com os outros.
export const TIPOS_PRESENCA_FISICA = new Set(['presencial', 'homeoffice', 'sabado'])

export interface EscalaParaSegmento {
  tp_escala: string
  cd_equipe: number
  ds_descricao: string | null
  tp_status: string
  cd_usuario_criador: number | string | null
}

// Cria uma nova escala de um único dia (ou período), copiando os dados da
// escala original, e atribui um técnico a ela. Usado tanto pra recortar um
// dia específico de uma troca comum quanto de uma troca direta.
export async function criarEscalaSegmento(
  client: PoolClient,
  escala: EscalaParaSegmento,
  dtInicio: string,
  dtFim: string,
  cdTecnico: number | string
): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO escalas (tp_escala, cd_equipe, dt_inicio, dt_fim, ds_descricao, tp_status, cd_usuario_criador)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING cd_escala`,
    [escala.tp_escala, escala.cd_equipe, dtInicio, dtFim, escala.ds_descricao, escala.tp_status, escala.cd_usuario_criador]
  )
  const novaEscalaId = rows[0].cd_escala
  await client.query('INSERT INTO escala_tecnicos (cd_escala, cd_tecnico) VALUES ($1, $2)', [novaEscalaId, cdTecnico])
  return novaEscalaId
}

// Troca quem ocupa uma escala — a escala inteira, ou só um subconjunto de
// dias específicos dentro dela (um, dois, vários — contíguos ou não).
// Recorta o período original em pedaços contíguos por dono e reatribui
// cada pedaço, criando escalas novas quando precisa. Usado tanto pela
// troca entre colegas (com pedido de aceite) quanto pela troca direta de
// admin/gestor (sem pedido).
export async function substituirTecnicoNoPeriodo(
  client: PoolClient,
  escala: EscalaParaSegmento & { cd_escala: number | string; dt_inicio: string; dt_fim: string },
  dias: string | string[] | null | undefined,
  tecnicoSai: number | string,
  tecnicoEntra: number | string
): Promise<void> {
  const { dt_inicio: inicio, dt_fim: fim, cd_escala: escalaId } = escala
  const diasEscolhidos = !dias ? [] : Array.isArray(dias) ? dias : [dias]
  const diasSet = new Set(diasEscolhidos)

  const todosOsDias: string[] = []
  for (let d = inicio; d <= fim; d = addDays(d, 1)) todosOsDias.push(d)

  const escolheuTudo = diasSet.size === 0 || todosOsDias.every(d => diasSet.has(d))
  if (escolheuTudo) {
    // escala inteira (nenhum dia específico escolhido, ou escolheu todos)
    await client.query(
      'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
      [tecnicoEntra, escalaId, tecnicoSai]
    )
    return
  }

  // Agrupa os dias em trechos contíguos por dono (quem fica com aquele
  // pedaço) — ex: [antigo: 28-29] [novo: 30] a partir de dias={30}.
  type Trecho = { inicio: string; fim: string; tecnico: number | string }
  const trechos: Trecho[] = []
  for (const dia of todosOsDias) {
    const dono = diasSet.has(dia) ? tecnicoEntra : tecnicoSai
    const ultimo = trechos[trechos.length - 1]
    if (ultimo && ultimo.tecnico === dono && addDays(ultimo.fim, 1) === dia) {
      ultimo.fim = dia
    } else {
      trechos.push({ inicio: dia, fim: dia, tecnico: dono })
    }
  }

  // O primeiro trecho reaproveita a linha original (só ajusta as datas e,
  // se for o caso, o técnico); os demais viram escalas novas.
  const [primeiro, ...resto] = trechos
  await client.query(
    'UPDATE escalas SET dt_inicio = $1, dt_fim = $2 WHERE cd_escala = $3',
    [primeiro.inicio, primeiro.fim, escalaId]
  )
  if (primeiro.tecnico !== tecnicoSai) {
    await client.query(
      'UPDATE escala_tecnicos SET cd_tecnico = $1 WHERE cd_escala = $2 AND cd_tecnico = $3',
      [primeiro.tecnico, escalaId, tecnicoSai]
    )
  }
  for (const trecho of resto) {
    await criarEscalaSegmento(client, escala, trecho.inicio, trecho.fim, trecho.tecnico)
  }
}

// Recorta a escala pra isolar exatamente os dias escolhidos numa linha
// própria — sem trocar quem é o dono. As outras partes do período viram
// escalas novas, mas continuam com o MESMO técnico de antes. Devolve o
// cd_escala que agora corresponde exatamente aos dias pedidos (a própria
// escala original, se os dias cobrem o período inteiro, ou se nenhum dia
// foi informado).
//
// Serve pra resolver de vez, na hora do PEDIDO de troca, qual escala
// representa "só esses dias" — assim, na hora de aceitar, trocar é sempre
// um caso só: a escala inteira (que naquele momento já é exatamente do
// tamanho certo) muda de dono. Evita precisar guardar uma lista de dias
// à parte (o banco só tem uma coluna de UM dia — "dt_dia" — então isolar
// antes é o jeito de suportar vários dias sem mudar o esquema da tabela).
export async function isolarDiasComoEscalaPropria(
  client: PoolClient,
  escala: EscalaParaSegmento & { cd_escala: number | string; dt_inicio: string; dt_fim: string },
  dias: string[] | null | undefined,
  tecnico: number | string
): Promise<number | string> {
  const { dt_inicio: inicio, dt_fim: fim, cd_escala: escalaId } = escala
  const diasSet = new Set(dias || [])
  if (diasSet.size === 0) return escalaId

  const todosOsDias: string[] = []
  for (let d = inicio; d <= fim; d = addDays(d, 1)) todosOsDias.push(d)
  if (todosOsDias.every(d => diasSet.has(d))) return escalaId

  type Trecho = { inicio: string; fim: string; selecionado: boolean }
  const trechos: Trecho[] = []
  for (const dia of todosOsDias) {
    const selecionado = diasSet.has(dia)
    const ultimo = trechos[trechos.length - 1]
    if (ultimo && ultimo.selecionado === selecionado && addDays(ultimo.fim, 1) === dia) {
      ultimo.fim = dia
    } else {
      trechos.push({ inicio: dia, fim: dia, selecionado })
    }
  }

  const [primeiro, ...resto] = trechos
  await client.query(
    'UPDATE escalas SET dt_inicio = $1, dt_fim = $2 WHERE cd_escala = $3',
    [primeiro.inicio, primeiro.fim, escalaId]
  )
  let idIsolado: number | string | null = primeiro.selecionado ? escalaId : null

  for (const trecho of resto) {
    const novoId = await criarEscalaSegmento(client, escala, trecho.inicio, trecho.fim, tecnico)
    if (trecho.selecionado) idIsolado = novoId
  }

  if (idIsolado === null) {
    throw new Error('Não foi possível isolar os dias selecionados')
  }
  return idIsolado
}

// Antes de atribuir um dia físico (presencial/home office/sábado) pra
// alguém, remove qualquer OUTRO compromisso físico que essa pessoa já
// tivesse nesse mesmo dia — sem isso, ela ficava com os dois ao mesmo
// tempo (ex: home office novo + presencial antigo intocado no mesmo dia),
// aparecendo duplicada no mapa e na legenda. Isola só o pedaço que colide
// (o resto da escala antiga continua normal) e manda esse pedaço pra
// lixeira — a pessoa simplesmente para de ter aquele outro compromisso
// nesse dia específico, já que agora tem outro. Usado tanto pela troca
// direta quanto por "atribuir sem troca".
export async function removerConflitosFisicos(
  client: PoolClient,
  cdEquipe: number,
  cdTecnico: number | string,
  dias: string[],
  ignorarCdEscalas: Array<number | string> = []
): Promise<void> {
  if (dias.length === 0) return
  const inicio = dias.reduce((a, b) => (a < b ? a : b))
  const fim = dias.reduce((a, b) => (a > b ? a : b))
  const ignorar = ignorarCdEscalas.map(String)
  const { rows } = await client.query(
    `SELECT es.cd_escala, es.tp_escala, es.cd_equipe, es.ds_descricao, es.tp_status, es.cd_usuario_criador,
            to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio, to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     WHERE et.cd_tecnico = $1 AND es.cd_equipe = $2
       AND es.tp_escala = ANY($5::text[]) AND es.tp_status != 'cancelada'
       AND es.dt_inicio <= $4 AND es.dt_fim >= $3
       AND NOT (es.cd_escala::text = ANY($6::text[]))`,
    [cdTecnico, cdEquipe, inicio, fim, Array.from(TIPOS_PRESENCA_FISICA), ignorar]
  )
  for (const escalaConflitante of rows) {
    const diasQueColidem = dias.filter(d => d >= escalaConflitante.dt_inicio && d <= escalaConflitante.dt_fim)
    if (diasQueColidem.length === 0) continue
    const idIsolado = await isolarDiasComoEscalaPropria(client, escalaConflitante, diasQueColidem, cdTecnico)
    await client.query(`UPDATE escalas SET tp_status = 'cancelada', dt_atualizacao = now() WHERE cd_escala = $1`, [idIsolado])
  }
}
