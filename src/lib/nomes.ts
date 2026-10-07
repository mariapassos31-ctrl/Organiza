// Ajuda a encurtar nome completo em telas com pouco espaço (mapa de
// baias, calendário de escalas, etc.) — pura, sem dependência de
// componente nenhum, pra poder ser reaproveitada por qualquer tela.

export function primeiroNome(nomeCompleto: string) {
  return nomeCompleto.trim().split(/\s+/)[0]
}

// Primeiro nome + sobrenome (a ÚLTIMA palavra, não a segunda) — pra nome
// com nome do meio, tipo "Sergio Ricardo Magalhães", vira "Sergio
// Magalhães", não "Sergio Ricardo".
export function nomeESobrenome(nomeCompleto: string) {
  const partes = nomeCompleto.trim().split(/\s+/)
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0]
}

// Mostra só o primeiro nome pra não poluir a tela — a não ser que dois
// nomes exibidos compartilhem o mesmo primeiro nome, aí mostra nome
// completo só desses, pra não confundir quem é quem.
export function criarExibidorDeNome(nomes: string[]) {
  const contagem: Record<string, number> = {}
  for (const nome of nomes) {
    const primeiro = primeiroNome(nome)
    contagem[primeiro] = (contagem[primeiro] || 0) + 1
  }
  return (nomeCompleto: string) => (contagem[primeiroNome(nomeCompleto)] > 1 ? nomeCompleto : primeiroNome(nomeCompleto))
}
