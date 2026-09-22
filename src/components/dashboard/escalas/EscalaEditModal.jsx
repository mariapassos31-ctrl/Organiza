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
  podeSolicitarTroca,
  colegasParaTroca,
  mostrarFormTroca,
  onAbrirFormTroca,
  onFecharFormTroca,
  tipoTroca,
  setTipoTroca,
  diaTroca,
  setDiaTroca,
  destinoTroca,
  setDestinoTroca,
  enviandoTroca,
  onEnviarTroca,
  podePropinTroca,
  minhasEscalasParaOferecer,
  nomeTipoEscala,
  escalaOferecidaId,
  setEscalaOferecidaId,
  onEnviarPropostaTroca,
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

          {podeSolicitarTroca && mostrarFormTroca && (
            <div className="troca-form">
              <div className="form-group">
                <label>O que deseja trocar?</label>
                <div className="troca-tipo-opcoes">
                  <label>
                    <input
                      type="radio"
                      name="tipoTroca"
                      checked={tipoTroca === 'completa'}
                      onChange={() => setTipoTroca('completa')}
                    />
                    Escala inteira
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="tipoTroca"
                      checked={tipoTroca === 'dia'}
                      onChange={() => setTipoTroca('dia')}
                    />
                    Só um dia
                  </label>
                </div>
              </div>
              {tipoTroca === 'dia' && (
                <div className="form-group">
                  <label>Qual dia?</label>
                  <input
                    type="date"
                    value={diaTroca}
                    min={formData.dataInicio}
                    max={formData.dataFim}
                    onChange={(e) => setDiaTroca(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Trocar com quem?</label>
                <select value={destinoTroca} onChange={(e) => setDestinoTroca(e.target.value)}>
                  <option value="">Selecione um colega...</option>
                  {colegasParaTroca.map(colega => (
                    <option key={colega.uid} value={colega.uid}>{colega.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {podePropinTroca && mostrarFormTroca && (
            <div className="troca-form">
              <p className="troca-explicacao">
                Essa escala é do(a) <strong>{getNomeTecnico(formData.tecnicos[0])}</strong>. Escolha qual das suas escalas você oferece em troca — se ele(a) aceitar, vocês trocam de escala.
              </p>
              <div className="form-group">
                <label>Qual das suas escalas você oferece?</label>
                <select value={escalaOferecidaId} onChange={(e) => setEscalaOferecidaId(e.target.value)}>
                  <option value="">Selecione uma escala sua...</option>
                  {minhasEscalasParaOferecer.map(e => (
                    <option key={e.id} value={e.id}>
                      {nomeTipoEscala(e.tipo)} · {e.dataInicio} a {e.dataFim}
                    </option>
                  ))}
                </select>
                {minhasEscalasParaOferecer.length === 0 && (
                  <small className="auto-campo-alerta">Você não tem nenhuma escala pra oferecer em troca.</small>
                )}
              </div>
            </div>
          )}

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
            {podeSolicitarTroca && !mostrarFormTroca && (
              <button type="button" className="btn-success" onClick={onAbrirFormTroca}>
                🔄 Solicitar Troca
              </button>
            )}
            {podeSolicitarTroca && mostrarFormTroca && (
              <button type="button" className="btn-success" disabled={enviandoTroca} onClick={onEnviarTroca}>
                {enviandoTroca ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            )}
            {podePropinTroca && !mostrarFormTroca && (
              <button type="button" className="btn-success" onClick={onAbrirFormTroca}>
                🔄 Propor Troca
              </button>
            )}
            {podePropinTroca && mostrarFormTroca && (
              <button type="button" className="btn-success" disabled={enviandoTroca} onClick={onEnviarPropostaTroca}>
                {enviandoTroca ? 'Enviando...' : 'Enviar Proposta'}
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={mostrarFormTroca ? onFecharFormTroca : onCancel}
            >
              {mostrarFormTroca ? 'Voltar' : canEdit ? 'Cancelar' : 'Fechar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
