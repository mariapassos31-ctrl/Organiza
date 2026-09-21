'use client'

import { EQUIPES } from '../../../lib/equipesConfig'
import { tiposDisponiveisParaEquipe } from '../../../lib/escalasConstants'

export default function EscalaEditModal({
  open,
  formData,
  setFormData,
  canEdit,
  isAdmin,
  tecnicosDisponiveis,
  getNomeTecnico,
  onSubmit,
  onDelete,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{canEdit ? 'Editar Escala' : 'Detalhes da Escala'}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <form className="escala-form-modal" onSubmit={onSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo *</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                disabled={!canEdit}
              >
                {tiposDisponiveisParaEquipe(formData.equipe).map(tipo => (
                  <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Data Início *</label>
              <input
                type="date"
                value={formData.dataInicio}
                onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                disabled={!canEdit}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Data Fim *</label>
              <input
                type="date"
                value={formData.dataFim}
                onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                disabled={!canEdit}
                required
              />
            </div>
            <div className="form-group">
              <label>Equipe *</label>
              <select
                value={formData.equipe}
                onChange={(e) => {
                  const novaEquipe = e.target.value
                  setFormData({
                    ...formData,
                    equipe: novaEquipe,
                    tipo: formData.tipo === 'sabado' && novaEquipe !== 'suporte' ? 'presencial' : formData.tipo,
                    tecnicos: []
                  })
                }}
                disabled={!canEdit || !isAdmin}
              >
                {canEdit && isAdmin ? (
                  EQUIPES.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.label}</option>
                  ))
                ) : (
                  <option value={formData.equipe}>
                    {EQUIPES.find(eq => eq.id === formData.equipe)?.label || formData.equipe}
                  </option>
                )}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Técnico/Analista *</label>
            <select
              value={formData.tecnicos[0] || ''}
              onChange={(e) => {
                setFormData({ ...formData, tecnicos: e.target.value ? [e.target.value] : [] })
              }}
              className="form-group-select"
              disabled={!canEdit}
            >
              {canEdit ? (
                <>
                  <option value="">Selecione um técnico...</option>
                  {tecnicosDisponiveis.map(tecnico => (
                    <option key={tecnico.uid} value={tecnico.uid}>
                      {tecnico.nome}
                    </option>
                  ))}
                </>
              ) : (
                <option value={formData.tecnicos[0] || ''}>
                  {getNomeTecnico(formData.tecnicos[0])}
                </option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Detalhes da escala..."
              disabled={!canEdit}
            />
          </div>
          <div className="form-actions-modal">
            {canEdit && (
              <button type="submit" className="btn-success">
                Atualizar
              </button>
            )}
            {canEdit && (
              <button type="button" className="btn-delete-modal" onClick={onDelete}>
                🗑️ Deletar
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {canEdit ? 'Cancelar' : 'Fechar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
