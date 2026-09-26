'use client'

import { POSICOES_BAIA } from './MapaBaias'
import { emojiDoMarcador } from './EditorPosicoesSala'
import { labelEquipe, labelPerfil } from '../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'
import type { Sala } from '../../../types/dominio'

// Só pra ver o que já está configurado numa sala (imagem, mapa, quem fica
// em cada baia) — nenhum campo aqui edita nada. Editar é só pela ⚙️, que
// abre o ConfigurarSala. Se a sala ainda não tem nada configurado, mostra
// o caminho pra fazer isso em vez de uma tela vazia sem explicação.
export default function VisualizarSala({ sala, onConfigurar, onClose }: {
  sala: Sala
  onConfigurar: () => void
  onClose: () => void
}) {
  const mostrarMapaFixo = sala.imagem === IMAGEM_COM_POSICOES_CONHECIDAS
  const numerosBaia = mostrarMapaFixo ? Object.keys(POSICOES_BAIA) : Array.from({ length: sala.qtdBaias || 9 }, (_, i) => String(i + 1))
  const posicoesProprias = sala.posicoes || {}
  const temMapaProprio = !mostrarMapaFixo && !!sala.imagem && numerosBaia.every(b => posicoesProprias[b])
  const mostrarMapa = mostrarMapaFixo || temMapaProprio
  const posicoesParaUsar = mostrarMapaFixo ? POSICOES_BAIA : posicoesProprias

  const aindaNaoConfigurada = !sala.imagem && Object.keys(sala.baias).length === 0

  const rotuloBaia = (baia: string) => {
    const valor = sala.baias[baia]
    if (sala.modoReserva === 'perfil') {
      if (!valor?.perfil) return '— Sem restrição —'
      return valor.perfil === 'supervisor' ? '⭐ Supervisor' : labelPerfil(valor.perfil)
    }
    // Especialidade é um dado sensível (só devia ser visto por gestão da
    // mesma equipe) — essa tela é vista por qualquer gestão da sala, então
    // mostra só a equipe, nunca a especialidade dela.
    if (!valor?.equipe) return '— Livre —'
    return labelEquipe(valor.equipe)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${mostrarMapa ? 'modal-content-largo' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🏢 {sala.nome}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">
            {sala.equipes.length > 0 ? `Equipe(s): ${sala.equipes.map(labelEquipe).join(', ')}` : 'Nenhuma equipe vinculada ainda.'}
          </p>

          {aindaNaoConfigurada ? (
            <div className="campo-nota" style={{ marginTop: 10 }}>
              <p style={{ margin: '0 0 10px' }}>
                Essa sala ainda não tem planta nem baias configuradas. Clique em <strong>⚙️ Configurar sala</strong> abaixo (ou na engrenagem da lista) pra definir a imagem, as posições e quem fica em cada baia.
              </p>
              <button type="button" className="btn-primary" onClick={onConfigurar}>
                ⚙️ Configurar sala
              </button>
            </div>
          ) : mostrarMapa ? (
            <div className="mapa-baias-wrapper">
              <img src={sala.imagem ?? undefined} alt={`Mapa da ${sala.nome}`} className="mapa-baias-imagem" />
              {numerosBaia.map(baia => (
                <div key={baia} className="mapa-baias-etiqueta mapa-baias-etiqueta-equipe" style={posicoesParaUsar[baia]}>
                  {rotuloBaia(baia)}
                </div>
              ))}
              {sala.marcadores?.map(m => (
                <div key={m.id} className="editor-marcador-item" style={{ top: m.top, left: m.left }}>
                  <span className="editor-marcador-icone">{emojiDoMarcador(m.tipo)}</span>
                  <span className="editor-marcador-rotulo">{m.rotulo}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {sala.imagem && (
                <p className="campo-nota" style={{ marginBottom: 10 }}>
                  Essa sala já tem planta, mas as posições de alguma baia ainda não foram marcadas — abra a ⚙️ e use "Ajustar posições" pra virar mapa visual.
                </p>
              )}
              <div className="config-baias-lista">
                {numerosBaia.map(baia => (
                  <div key={baia} className="config-baia-linha">
                    <span className="config-baia-linha-numero">Baia {baia}</span>
                    <span>{rotuloBaia(baia)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
