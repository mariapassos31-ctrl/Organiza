'use client'

// Posições (em % da imagem) das etiquetas de cada baia no mapa da sala.
// Ajustar aqui se a imagem do mapa for trocada e as caixas mudarem de lugar.
const POSICOES_BAIA = {
  1: { top: '69.2%', left: '37.6%' },
  2: { top: '69.2%', left: '60.3%' },
  3: { top: '53.7%', left: '73%' },
  4: { top: '35.5%', left: '73%' },
  5: { top: '17.3%', left: '73%' },
  6: { top: '35.5%', left: '54.4%' },
  7: { top: '54.1%', left: '26.7%' },
  8: { top: '35.7%', left: '26.7%' },
  9: { top: '17.3%', left: '26.7%' },
}
const POSICAO_SUPERVISOR = { top: '6.5%', left: '50%' }

function primeiroNome(nomeCompleto) {
  return nomeCompleto.trim().split(/\s+/)[0]
}

// Mostra só o primeiro nome pra não poluir o mapa — a não ser que dois
// ocupantes exibidos compartilhem o mesmo primeiro nome, aí mostra nome
// completo só desses, pra não confundir quem é quem.
function criarExibidorDeNome(nomes) {
  const contagem = {}
  for (const nome of nomes) {
    const primeiro = primeiroNome(nome)
    contagem[primeiro] = (contagem[primeiro] || 0) + 1
  }
  return (nomeCompleto) => (contagem[primeiroNome(nomeCompleto)] > 1 ? nomeCompleto : primeiroNome(nomeCompleto))
}

// ocupantes: { [nrBaia]: nomeTecnico }
export default function MapaBaias({ ocupantes, nomeSupervisor }) {
  const todosNomes = [...Object.values(ocupantes), ...(nomeSupervisor ? [nomeSupervisor] : [])]
  const exibirNome = criarExibidorDeNome(todosNomes)

  return (
    <div className="mapa-baias-wrapper">
      <img src="/images/mapa-baias.png" alt="Mapa da sala com as baias" className="mapa-baias-imagem" />

      <div className="mapa-baias-etiqueta mapa-baias-supervisor" style={POSICAO_SUPERVISOR}>
        {nomeSupervisor ? exibirNome(nomeSupervisor) : '—'}
      </div>

      {Object.entries(POSICOES_BAIA).map(([baia, pos]) => (
        <div key={baia} className="mapa-baias-etiqueta" style={pos}>
          {ocupantes[baia] ? exibirNome(ocupantes[baia]) : '—'}
        </div>
      ))}
    </div>
  )
}
