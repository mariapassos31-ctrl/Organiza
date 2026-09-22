// Feriados nacionais + estaduais (Bahia) + municipais (Salvador) — usado
// pra excluir esses dias da escala de presencial/home office/sábado (a
// empresa não abre nesses dias). Calculado ano a ano, não hardcoded, pra
// continuar certo em qualquer ano futuro sem precisar mexer aqui de novo.

// Domingo de Páscoa de um ano (algoritmo do computus gregoriano/Gauss).
function calcularPascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return { mes, dia }
}

function formatarData(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// Soma/subtrai dias a partir de uma data ano/mes/dia, cruzando mês/ano se preciso.
function deslocarData(ano, mes, dia, delta) {
  const dt = new Date(ano, mes - 1, dia)
  dt.setDate(dt.getDate() + delta)
  return { ano: dt.getFullYear(), mes: dt.getMonth() + 1, dia: dt.getDate() }
}

// Feriados fixos (nacionais + Bahia/Salvador) — [mês, dia, nome].
const FERIADOS_FIXOS = [
  [1, 1, 'Confraternização Universal'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [6, 24, 'São João'],
  [7, 2, 'Independência da Bahia'],
  [9, 7, 'Independência do Brasil'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Consciência Negra'],
  [12, 8, 'Nossa Senhora da Conceição da Praia'],
  [12, 25, 'Natal'],
]

// Móveis, baseados na Páscoa — [deslocamento em dias, nome]. Só a terça de
// Carnaval é feriado (a segunda não é, aqui).
const FERIADOS_MOVEIS = [
  [-47, 'Carnaval'],
  [-2, 'Sexta-feira Santa'],
  [60, 'Corpus Christi'],
]

const cachePorAno = new Map()

// Mapa 'YYYY-MM-DD' -> nome do feriado, com todos os feriados de um ano:
// nacionais + móveis (Carnaval, Sexta-feira Santa, Corpus Christi) +
// Bahia/Salvador.
export function feriadosDoAno(ano) {
  if (cachePorAno.has(ano)) return cachePorAno.get(ano)

  const pascoa = calcularPascoa(ano)
  const mapa = new Map()
  for (const [mes, dia, nome] of FERIADOS_FIXOS) {
    mapa.set(formatarData(ano, mes, dia), nome)
  }
  for (const [delta, nome] of FERIADOS_MOVEIS) {
    const d = deslocarData(ano, pascoa.mes, pascoa.dia, delta)
    mapa.set(formatarData(d.ano, d.mes, d.dia), nome)
  }

  cachePorAno.set(ano, mapa)
  return mapa
}

// dataStr: 'YYYY-MM-DD'
export function ehFeriado(dataStr) {
  const ano = Number(dataStr.slice(0, 4))
  return feriadosDoAno(ano).has(dataStr)
}

// Nome do feriado nessa data, ou null se não for feriado.
export function nomeFeriado(dataStr) {
  const ano = Number(dataStr.slice(0, 4))
  return feriadosDoAno(ano).get(dataStr) || null
}
