'use client'

import { EQUIPES } from '../../../lib/equipesConfig'
import { TIPOS_ESCALA } from '../../../lib/escalasConstants'
import MapaBaias from './MapaBaias'

export default function DiaDetalhadoModal({ diaDetalhado, onClose, podeEditarEscala, onEditarEscala, getNomeTecnico, usuarios }) {
  if (!diaDetalhado) return null

  const escalasSuporte = diaDetalhado.escalas.filter(e => e.equipe === 'suporte')
  const mostrarMapa = escalasSuporte.length > 0

  const ocupantesPorBaia = {}
  if (mostrarMapa) {
    for (const escala of escalasSuporte) {
      if (escala.tipo !== 'presencial') continue
      const uid = escala.tecnicos[0]
      const usuario = usuarios?.find(u => u.uid === uid)
      if (usuario?.baia) ocupantesPorBaia[usuario.baia] = usuario.nome
    }
  }
  const nomeSupervisor = mostrarMapa
    ? usuarios?.find(u => u.equipe === 'suporte' && u.role === 'gestor')?.nome
    : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📅 Escalados em {diaDetalhado.data.toLocaleDateString('pt-BR')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {mostrarMapa && (
          <div style={{ padding: '0 20px' }}>
            <MapaBaias ocupantes={ocupantesPorBaia} nomeSupervisor={nomeSupervisor} />
          </div>
        )}

        <div className="dia-detalhado-lista">
          {diaDetalhado.escalas.map(escala => {
            const tipo = TIPOS_ESCALA.find(t => t.id === escala.tipo)
            const equipe = EQUIPES.find(e => e.id === escala.equipe)
            return (
              <div
                key={escala.id}
                className="dia-detalhado-item"
                onClick={() => { onClose(); onEditarEscala(escala) }}
                title={podeEditarEscala(escala) ? 'Clique para editar' : 'Clique para ver detalhes'}
              >
                <span className="dia-detalhado-tipo" style={{ backgroundColor: tipo?.cor }}>{tipo?.label}</span>
                <span className="dia-detalhado-tecnico">{getNomeTecnico(escala.tecnicos[0])}</span>
                <span className="dia-detalhado-equipe">{equipe?.label || escala.equipe}</span>
              </div>
            )
          })}
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
