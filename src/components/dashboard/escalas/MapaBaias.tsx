'use client'

import { useState } from 'react'
import { labelPerfil } from '../../../lib/equipesConfig'
import { POSICOES_BAIA, type Posicao } from '../../../lib/ocupacaoBaias'
import type { OcupanteAprendiz } from '../../../types/dominio'

export { POSICOES_BAIA }
export type { Posicao }

export function primeiroNome(nomeCompleto: string) {
  return nomeCompleto.trim().split(/\s+/)[0]
}

// labelPerfil() vem com emoji (bom nos seletores/badges) — na etiqueta do
// mapa da sala isso só atrapalha a leitura, então tira o emoji daqui.
function semEmoji(texto: string) {
  return texto.replace(/^[\p{Extended_Pictographic}‍️]+\s*/u, '')
}

// Mostra só o primeiro nome pra não poluir o mapa — a não ser que dois
// ocupantes exibidos compartilhem o mesmo primeiro nome, aí mostra nome
// completo só desses, pra não confundir quem é quem.
export function criarExibidorDeNome(nomes: string[]) {
  const contagem: Record<string, number> = {}
  for (const nome of nomes) {
    const primeiro = primeiroNome(nome)
    contagem[primeiro] = (contagem[primeiro] || 0) + 1
  }
  return (nomeCompleto: string) => (contagem[primeiroNome(nomeCompleto)] > 1 ? nomeCompleto : primeiroNome(nomeCompleto))
}

// ocupantesBaia: [{ nome, turno }] — até 2 (um de manhã, um de tarde). Uma
// baia fixa (o caso comum) só tem 1 pessoa: mostra o nome dela direto, sem
// precisar clicar. Só quando há 2 pessoas (turnos diferentes) ou nenhuma,
// mostra o rótulo do perfil (Trainee/Estag/Aprendiz) — clique abre uma
// janelinha flutuante com os nomes de quem reveza ali.
function EtiquetaRestrita({ ocupantesBaia, posicao, rotulo }: { ocupantesBaia: OcupanteAprendiz[]; posicao: Posicao; rotulo: string }) {
  const [revelado, setRevelado] = useState(false)
  const textoEtiqueta = ocupantesBaia.length === 1 ? primeiroNome(ocupantesBaia[0].nome) : rotulo

  return (
    <div
      className="mapa-baias-etiqueta mapa-baias-etiqueta-aprendiz"
      style={posicao}
      onClick={() => setRevelado(r => !r)}
      title="Clique para ver quem está nessa mesa"
    >
      {textoEtiqueta}
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
export default function MapaBaias({ ocupantes, ocupantesAprendiz, baiasJovemAprendiz = {}, baiaSupervisor = null }: {
  ocupantes: Record<string, string>
  ocupantesAprendiz?: Record<string, OcupanteAprendiz[]>
  baiasJovemAprendiz?: Record<string, string>
  baiaSupervisor?: string | null
}) {
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
            rotulo={semEmoji(labelPerfil(baiasJovemAprendiz[baia])).replace('/', '/​')}
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
