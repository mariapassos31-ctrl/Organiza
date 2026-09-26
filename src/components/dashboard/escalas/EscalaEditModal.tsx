'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { EQUIPES } from '../../../lib/equipesConfig'
import type { Escala, FormEscala, Sala, Usuario } from '../../../types/dominio'
import { tiposDisponiveisParaEquipe } from '../../../lib/escalasConstants'
import { formatarDataBR, SeletorPeriodoOuDias, SeletorDiasSimples, SeletorDiasProporcional } from './SeletorDiasTroca'

export default function EscalaEditModal({
  open,
  formData,
  setFormData,
  canEdit,
  isAdmin,
  salas,
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
  diasTroca,
  setDiasTroca,
  destinoTroca,
  setDestinoTroca,
  enviandoTroca,
  onEnviarTroca,
  podePropinTroca,
  minhasEscalasParaOferecer,
  nomeTipoEscala,
  escalaOferecidaId,
  setEscalaOferecidaId,
  diasSolicitadaTroca,
  setDiasSolicitadaTroca,
  onEnviarPropostaTroca,
  mostrarOpcaoTrocarDireto,
  nomeTecnicoOriginal,
  tecnicoFoiTrocado,
  trocarDireto,
  setTrocarDireto,
  diasTrocaDireta,
  setDiasTrocaDireta,
  escalasDoDestinoParaTrocaDireta,
  escalaParTrocaDireta,
  setEscalaParTrocaDireta,
  diasTrocaParDireta,
  setDiasTrocaParDireta,
}: {
  open: boolean
  formData: FormEscala
  setFormData: Dispatch<SetStateAction<FormEscala>>
  canEdit: boolean
  isAdmin: boolean
  salas: Sala[]
  tecnicosDisponiveis: Usuario[]
  getNomeTecnico: (uid: string) => string
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onDelete: () => void
  onCancel: () => void
  podeSolicitarTroca: boolean
  colegasParaTroca: Usuario[]
  mostrarFormTroca: boolean
  onAbrirFormTroca: () => void
  onFecharFormTroca: () => void
  tipoTroca: 'completa' | 'dias'
  setTipoTroca: (valor: 'completa' | 'dias') => void
  diasTroca: string[]
  setDiasTroca: Dispatch<SetStateAction<string[]>>
  destinoTroca: string
  setDestinoTroca: (valor: string) => void
  enviandoTroca: boolean
  onEnviarTroca: () => void
  podePropinTroca: boolean
  minhasEscalasParaOferecer: Escala[]
  nomeTipoEscala: (tipoId: string) => string
  escalaOferecidaId: string
  setEscalaOferecidaId: (valor: string) => void
  diasSolicitadaTroca: string[]
  setDiasSolicitadaTroca: Dispatch<SetStateAction<string[]>>
  onEnviarPropostaTroca: () => void
  mostrarOpcaoTrocarDireto: boolean
  nomeTecnicoOriginal: string
  tecnicoFoiTrocado: boolean
  trocarDireto: boolean
  setTrocarDireto: (valor: boolean) => void
  diasTrocaDireta: string[]
  setDiasTrocaDireta: Dispatch<SetStateAction<string[]>>
  escalasDoDestinoParaTrocaDireta: Escala[]
  escalaParTrocaDireta: string
  setEscalaParTrocaDireta: (valor: string) => void
  diasTrocaParDireta: string[]
  setDiasTrocaParDireta: Dispatch<SetStateAction<string[]>>
}) {
  if (!open) return null

  const escalaOferecidaSelecionada = minhasEscalasParaOferecer?.find(e => e.id === escalaOferecidaId)

  // Só faz sentido escolher sala quando a equipe está em mais de uma
  // (formalizadas num rodízio "Entre Salas" ou não — qualquer configuração
  // com 2+ salas pra mesma equipe é ambígua) — nos outros casos a sala já
  // é descoberta sozinha, não precisa escolher aqui.
  const salasDaEquipe = salas.filter(s => s.equipes.includes(formData.equipe ?? ''))
  const mostrarSelecaoSala = (formData.tipo === 'presencial' || formData.tipo === 'sabado') && salasDaEquipe.length > 1

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
                disabled={!canEdit || trocarDireto}
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
                disabled={!canEdit || trocarDireto}
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
                disabled={!canEdit || trocarDireto}
                required
              />
            </div>
            <div className="form-group">
              <label>Equipe *</label>
              <select
                value={formData.equipe ?? ""}
                onChange={(e) => {
                  const novaEquipe = e.target.value
                  setFormData({
                    ...formData,
                    equipe: novaEquipe,
                    tipo: formData.tipo === 'sabado' && novaEquipe !== 'suporte' ? 'presencial' : formData.tipo,
                    tecnicos: []
                  })
                }}
                disabled={!canEdit || !isAdmin || trocarDireto}
              >
                {canEdit && isAdmin ? (
                  EQUIPES.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.label}</option>
                  ))
                ) : (
                  <option value={formData.equipe ?? ""}>
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
          {mostrarOpcaoTrocarDireto && (
            <>
              <label className="campo-toggle campo-toggle-trocar-direto">
                <input
                  type="checkbox"
                  checked={trocarDireto}
                  onChange={(e) => setTrocarDireto(e.target.checked)}
                />
                🔄 Trocar direto — escolha o que cada um dá na troca
              </label>
              {trocarDireto && !tecnicoFoiTrocado && (
                <p className="auto-campo-alerta">
                  Escolha, no campo Técnico/Analista acima, a pessoa que vai entrar no lugar de <strong>{nomeTecnicoOriginal}</strong>.
                </p>
              )}
              {trocarDireto && tecnicoFoiTrocado && (
                <div className="troca-form">
                  <p className="troca-explicacao">
                    <strong>{nomeTecnicoOriginal}</strong> oferece:
                  </p>
                  <SeletorDiasSimples
                    dias={diasTrocaDireta}
                    setDias={setDiasTrocaDireta}
                    dataInicio={formData.dataInicio}
                    dataFim={formData.dataFim}
                  />

                  <p className="troca-explicacao">
                    Em troca, <strong>{getNomeTecnico(formData.tecnicos[0])}</strong> oferece:
                  </p>
                  <div className="form-group">
                    <select
                      value={escalaParTrocaDireta}
                      onChange={(e) => {
                        setEscalaParTrocaDireta(e.target.value)
                        setDiasTrocaParDireta([])
                      }}
                    >
                      <option value="">Selecione a escala...</option>
                      {escalasDoDestinoParaTrocaDireta.map(e => (
                        <option key={e.id} value={e.id}>
                          {formatarDataBR(e.dataInicio)} a {formatarDataBR(e.dataFim)}
                        </option>
                      ))}
                    </select>
                    {escalasDoDestinoParaTrocaDireta.length === 0 && (
                      <small className="auto-campo-alerta">
                        {getNomeTecnico(formData.tecnicos[0])} não tem nenhuma escala de {formData.tipo === 'homeoffice' ? 'Home Office' : formData.tipo} pra oferecer em troca.
                      </small>
                    )}
                  </div>
                  {/* Sem opção de "escala inteira" aqui: a troca precisa ser
                      equivalente, então o outro lado sempre marca dia a dia,
                      até bater a mesma quantidade escolhida em cima. */}
                  {escalaParTrocaDireta && (
                    <SeletorDiasProporcional
                      dias={diasTrocaParDireta}
                      setDias={setDiasTrocaParDireta}
                      dataInicio={escalasDoDestinoParaTrocaDireta.find(e => e.id === escalaParTrocaDireta)?.dataInicio || ''}
                      dataFim={escalasDoDestinoParaTrocaDireta.find(e => e.id === escalaParTrocaDireta)?.dataFim || ''}
                      limite={diasTrocaDireta.length}
                    />
                  )}
                </div>
              )}
            </>
          )}
          {!trocarDireto && mostrarSelecaoSala && (
            <div className="form-group">
              <label>Sala</label>
              <select
                value={formData.salaId ?? ''}
                onChange={(e) => setFormData({ ...formData, salaId: e.target.value ? Number(e.target.value) : null })}
                disabled={!canEdit}
              >
                <option value="">— Ainda não definida —</option>
                {salasDaEquipe.map(sala => (
                  <option key={sala.id} value={sala.id}>{sala.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={formData.descricao ?? ""}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Detalhes da escala..."
              disabled={!canEdit || trocarDireto}
            />
          </div>

          {podeSolicitarTroca && mostrarFormTroca && (
            <div className="troca-form">
              <p className="troca-explicacao">O que você oferece:</p>
              <SeletorPeriodoOuDias
                nomeGrupo="tipoTroca"
                tipo={tipoTroca}
                setTipo={setTipoTroca}
                dias={diasTroca}
                setDias={setDiasTroca}
                dataInicio={formData.dataInicio}
                dataFim={formData.dataFim}
              />
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
                <select
                  className="troca-select-escala"
                  value={escalaOferecidaId}
                  onChange={(e) => {
                    setEscalaOferecidaId(e.target.value)
                    setDiasTroca([])
                    setDiasSolicitadaTroca([])
                  }}
                >
                  <option value="">Selecione uma escala sua...</option>
                  {minhasEscalasParaOferecer.map(e => (
                    <option key={e.id} value={e.id}>
                      {nomeTipoEscala(e.tipo)} · {formatarDataBR(e.dataInicio)} a {formatarDataBR(e.dataFim)}
                    </option>
                  ))}
                </select>
                {minhasEscalasParaOferecer.length === 0 && (
                  <small className="auto-campo-alerta">Você não tem nenhuma escala pra oferecer em troca.</small>
                )}
              </div>

              {escalaOferecidaSelecionada && (
                <>
                  <p className="troca-explicacao">Você oferece:</p>
                  <SeletorDiasSimples
                    dias={diasTroca}
                    setDias={setDiasTroca}
                    dataInicio={escalaOferecidaSelecionada.dataInicio}
                    dataFim={escalaOferecidaSelecionada.dataFim}
                  />
                  {/* Sem opção de "escala inteira" aqui: a troca precisa ser
                      equivalente, então o que você pede sempre acompanha
                      exatamente a quantidade que você ofereceu em cima. */}
                  <p className="troca-explicacao">Você pede (de {getNomeTecnico(formData.tecnicos[0])}):</p>
                  <SeletorDiasProporcional
                    dias={diasSolicitadaTroca}
                    setDias={setDiasSolicitadaTroca}
                    dataInicio={formData.dataInicio}
                    dataFim={formData.dataFim}
                    limite={diasTroca.length}
                  />
                </>
              )}
            </div>
          )}

          <div className="form-actions-modal">
            {canEdit && (
              <button type="submit" className="btn-success">
                {trocarDireto ? '🔄 Trocar' : 'Atualizar'}
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
