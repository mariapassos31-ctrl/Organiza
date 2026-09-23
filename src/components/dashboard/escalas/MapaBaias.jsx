'use client'

import { useState } from 'react'
import { labelPerfil } from '../../../lib/equipesConfig'

// Posições (em % da imagem) das etiquetas de cada baia no mapa da sala,
// incluindo a mesa do Supervisor ("0" — ela já é desenhada como uma mesa à
// parte na própria imagem, separada das outras 9). Ajustar aqui se a
// imagem do mapa for trocada e as caixas mudarem de lugar. Exportadas
// porque a tela de configuração (ConfigBaiasMapa) reusa o mesmo layout pra
// mostrar o mapa de verdade enquanto configura.
export const POSICOES_BAIA = {
  0: { top: '6.5%', left: '50%' },
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
function primeiroNome(nomeCompleto) {
  return nomeCompleto.trim().split(/\s+/)[0]
}

// labelPerfil() vem com emoji (bom nos seletores/badges) — na etiqueta do
// mapa da sala isso só atrapalha a leitura, então tira o emoji daqui.
function semEmoji(texto) {
  return texto.replace(/^[\p{Extended_Pictographic}‍️]+\s*/u, '')
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

// ocupantesBaia: [{ nome, turno }] — até 2 (um de manhã, um de tarde).
// Clique abre uma janelinha flutuante com os nomes (não tenta espremer o
// texto dentro da etiqueta, que é pequena demais pra isso).
function EtiquetaRestrita({ ocupantesBaia, posicao, rotulo }) {
  const [revelado, setRevelado] = useState(false)

  return (
    <div
      className="mapa-baias-etiqueta mapa-baias-etiqueta-aprendiz"
      style={posicao}
      onClick={() => setRevelado(r => !r)}
      title="Clique para ver quem está nessa mesa"
    >
      {rotulo}
      {revelado && (
        <div className="mapa-baias-popover">
          {ocupantesBaia.length === 0 ? (
            <span>Ninguém escalado</span>
          ) : (
            ocupantesBaia.map(o => (
              <span key={o.nome}>
                {o.turno ? `${o.turno}: ` : ''}
                {primeiroNome(o.nome)}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ocupantes: { [nrBaia]: nomeTecnico } — inclui a baia "0" (mesa do
// Supervisor) normalmente, como qualquer outra. Não inclui as mesas de
// baiasJovemAprendiz, que usam
// ocupantesAprendiz: { [nrBaia]: [{ nome, turno }] } em vez disso.
// baiasJovemAprendiz: { [nrBaia]: perfilId } (só as reservadas a
// Estag/Aprendiz ou Trainee — as reservadas a outros perfis, incluindo
// Supervisor, aparecem em "ocupantes" normalmente).
export default function MapaBaias({ ocupantes, ocupantesAprendiz, baiasJovemAprendiz = {}, baiaSupervisor = null }) {
  const todosNomes = Object.values(ocupantes)
  const exibirNome = criarExibidorDeNome(todosNomes)

  return (
    <div className="mapa-baias-wrapper">
      <img src="/images/mapa-baias.png" alt="Mapa da sala com as baias" className="mapa-baias-imagem" />

      {Object.entries(POSICOES_BAIA).map(([baia, pos]) =>
        baiasJovemAprendiz[baia] ? (
          <EtiquetaRestrita
            key={baia}
            ocupantesBaia={ocupantesAprendiz?.[baia] || []}
            posicao={pos}
            rotulo={semEmoji(labelPerfil(baiasJovemAprendiz[baia]))}
          />
        ) : (
          <div
            key={baia}
            className={`mapa-baias-etiqueta ${baia === baiaSupervisor ? 'mapa-baias-supervisor' : ''}`}
            style={pos}
          >
            {ocupantes[baia] ? exibirNome(ocupantes[baia]) : '—'}
          </div>
        )
      )}
    </div>
  )
}
