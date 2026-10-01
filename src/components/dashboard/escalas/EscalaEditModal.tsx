'use client'

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { EQUIPES } from '../../../lib/equipesConfig'
import type { Escala, FormEscala, Sala, Usuario } from '../../../types/dominio'
import { tiposDisponiveisParaEquipe } from '../../../lib/escalasConstants'
import { formatarDataBR, listarDiasDoPeriodo, SeletorPeriodoOuDias, SeletorDiasSimples, SeletorDiasProporcional, PainelDeParaTroca } from './SeletorDiasTroca'

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
  escalasDoColegaParaTroca,
  itensExtrasTroca,
  onAdicionarItemExtraTroca,
  onRemoverItemExtraTroca,
  onAtualizarItemExtraTroca,
  setDiasOferecidosExtra,
  setDiasSolicitadosExtra,
  onEnviarPropostaTroca,
  mostrarOpcaoTrocarDireto,
  nomeTecnicoOriginal,
  tecnicoOriginalUid,
  tecnicoFoiTrocado,
  trocarDireto,
  setTrocarDireto,
  novoTecnicoTrocaDireto,
  setNovoTecnicoTrocaDireto,
  diasTrocaDireta,
  setDiasTrocaDireta,
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
  escalasDoColegaParaTroca: Escala[]
  itensExtrasTroca: Array<{ escalaOferecidaId: string; diasOferecidos: string[]; escalaSolicitadaId: string; diasSolicitados: string[] }>
  onAdicionarItemExtraTroca: () => void
  onRemoverItemExtraTroca: (indice: number) => void
  onAtualizarItemExtraTroca: (indice: number, patch: Partial<{ escalaOferecidaId: string; diasOferecidos: string[]; escalaSolicitadaId: string; diasSolicitados: string[] }>) => void
  setDiasOferecidosExtra: (indice: number) => Dispatch<SetStateAction<string[]>>
  setDiasSolicitadosExtra: (indice: number) => Dispatch<SetStateAction<string[]>>
  onEnviarPropostaTroca: () => void
  mostrarOpcaoTrocarDireto: boolean
  nomeTecnicoOriginal: string
  tecnicoOriginalUid: string | null
  tecnicoFoiTrocado: boolean
  trocarDireto: boolean
  setTrocarDireto: (valor: boolean) => void
  novoTecnicoTrocaDireto: string
  setNovoTecnicoTrocaDireto: (valor: string) => void
  diasTrocaDireta: string[]
  setDiasTrocaDireta: Dispatch<SetStateAction<string[]>>
}) {
  if (!open) return null

  const escalaOferecidaSelecionada = minhasEscalasParaOferecer?.find(e => e.id === escalaOferecidaId)

  // "Escala inteira ou dias específicos" — mesmo componente e mesma lógica
  // da tela do usuário (solicitar troca): um registro só, bem delimitado
  // (a escala que foi aberta pra editar). Sem mostrar o que cada lado já
  // tem dia a dia — o back-end já resolve sozinho quem fica com o quê.
  const [tipoTrocaDireta, setTipoTrocaDireta] = useState<'completa' | 'dias'>('dias')
  useEffect(() => {
    if (tipoTrocaDireta === 'completa') setDiasTrocaDireta(listarDiasDoPeriodo(formData.dataInicio, formData.dataFim))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoTrocaDireta, formData.dataInicio, formData.dataFim])
  // O modal não desmonta entre uma troca e outra (só esconde) — sem isso,
  // "Escala inteira" ficaria marcado sozinho na próxima vez que abrir o
  // "Trocar direto", mesmo pra uma escala/pessoa completamente diferente.
  useEffect(() => {
    if (!trocarDireto) setTipoTrocaDireta('dias')
  }, [trocarDireto])

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
          {mostrarOpcaoTrocarDireto && (
            <label className="campo-toggle campo-toggle-trocar-direto">
              <input
                type="checkbox"
                checked={trocarDireto}
                onChange={(e) => setTrocarDireto(e.target.checked)}
              />
              🔄 Trocar direto — escolha os dias e quem entra no lugar
            </label>
          )}
          <div className="form-group">
            <label>Técnico/Analista</label>
            {/* Sempre travado — reatribuir direto por aqui pularia toda a
                lógica de troca (quem assume o lugar de quem, conflito de
                horário/especialidade etc.). Pra trocar quem está na
                escala, usa "Trocar direto" (ou solicita uma troca). */}
            <input type="text" value={getNomeTecnico(formData.tecnicos[0])} disabled />
          </div>
          {mostrarOpcaoTrocarDireto && trocarDireto && (
            <>
              <div className="form-group">
                <label>🔄 Trocar com quem?</label>
                <select
                  className="troca-select-escala"
                  value={novoTecnicoTrocaDireto}
                  onChange={(e) => setNovoTecnicoTrocaDireto(e.target.value)}
                >
                  <option value="">Selecione um colega...</option>
                  {tecnicosDisponiveis.filter(t => t.uid !== tecnicoOriginalUid).map(tecnico => (
                    <option key={tecnico.uid} value={tecnico.uid}>{tecnico.nome}</option>
                  ))}
                </select>
              </div>
              {tecnicoFoiTrocado && (
                <div className="troca-form">
                  <p className="de-para-painel-subtitulo">
                    Trocar entre <strong>{nomeTecnicoOriginal}</strong> e <strong>{getNomeTecnico(novoTecnicoTrocaDireto)}</strong>:
                  </p>
                  <SeletorPeriodoOuDias
                    nomeGrupo="trocaDiretaTipoSelecao"
                    tipo={tipoTrocaDireta}
                    setTipo={setTipoTrocaDireta}
                    dias={diasTrocaDireta}
                    setDias={setDiasTrocaDireta}
                    dataInicio={formData.dataInicio}
                    dataFim={formData.dataFim}
                  />
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
                  {/* Sem opção de "escala inteira" aqui: a troca precisa ser
                      equivalente, então o que você pede sempre acompanha
                      exatamente a quantidade que você ofereceu do outro lado. */}
                  <PainelDeParaTroca
                    esquerda={
                      <>
                        <p className="de-para-painel-titulo">Você dá</p>
                        <SeletorDiasSimples
                          dias={diasTroca}
                          setDias={setDiasTroca}
                          dataInicio={escalaOferecidaSelecionada.dataInicio}
                          dataFim={escalaOferecidaSelecionada.dataFim}
                        />
                      </>
                    }
                    direita={
                      <>
                        <p className="de-para-painel-titulo">Você pede de {getNomeTecnico(formData.tecnicos[0])}</p>
                        <p className="de-para-painel-subtitulo">{nomeTipoEscala(formData.tipo)} · {formatarDataBR(formData.dataInicio)} a {formatarDataBR(formData.dataFim)}</p>
                        <SeletorDiasProporcional
                          dias={diasSolicitadaTroca}
                          setDias={setDiasSolicitadaTroca}
                          dataInicio={formData.dataInicio}
                          dataFim={formData.dataFim}
                          limite={diasTroca.length}
                        />
                      </>
                    }
                  />

                  {itensExtrasTroca.map((item, indice) => {
                    const escalaOferecidaExtra = minhasEscalasParaOferecer?.find(e => e.id === item.escalaOferecidaId)
                    const escalaSolicitadaExtra = escalasDoColegaParaTroca?.find(e => e.id === item.escalaSolicitadaId)
                    return (
                      <div key={indice} className="troca-item-extra">
                        <div className="troca-item-extra-header">
                          <span>Dia/período extra {indice + 1}</span>
                          <button type="button" className="btn-secondary" onClick={() => onRemoverItemExtraTroca(indice)}>
                            🗑️ Remover
                          </button>
                        </div>

                        <PainelDeParaTroca
                          esquerda={
                            <>
                              <p className="de-para-painel-titulo">Você dá</p>
                              <select
                                className="troca-select-escala"
                                value={item.escalaOferecidaId}
                                onChange={(e) => onAtualizarItemExtraTroca(indice, { escalaOferecidaId: e.target.value, diasOferecidos: [], diasSolicitados: [] })}
                              >
                                <option value="">Selecione uma escala sua...</option>
                                {minhasEscalasParaOferecer.map(e => (
                                  <option key={e.id} value={e.id}>
                                    {nomeTipoEscala(e.tipo)} · {formatarDataBR(e.dataInicio)} a {formatarDataBR(e.dataFim)}
                                  </option>
                                ))}
                              </select>
                              {escalaOferecidaExtra && (
                                <SeletorDiasSimples
                                  dias={item.diasOferecidos}
                                  setDias={setDiasOferecidosExtra(indice)}
                                  dataInicio={escalaOferecidaExtra.dataInicio}
                                  dataFim={escalaOferecidaExtra.dataFim}
                                />
                              )}
                            </>
                          }
                          direita={
                            <>
                              <p className="de-para-painel-titulo">Você pede de {getNomeTecnico(formData.tecnicos[0])}</p>
                              <select
                                className="troca-select-escala"
                                value={item.escalaSolicitadaId}
                                onChange={(e) => onAtualizarItemExtraTroca(indice, { escalaSolicitadaId: e.target.value, diasSolicitados: [] })}
                              >
                                <option value="">Selecione uma escala dele(a)...</option>
                                {escalasDoColegaParaTroca.map(e => (
                                  <option key={e.id} value={e.id}>
                                    {nomeTipoEscala(e.tipo)} · {formatarDataBR(e.dataInicio)} a {formatarDataBR(e.dataFim)}
                                  </option>
                                ))}
                              </select>
                              {escalaOferecidaExtra && escalaSolicitadaExtra && (
                                <SeletorDiasProporcional
                                  dias={item.diasSolicitados}
                                  setDias={setDiasSolicitadosExtra(indice)}
                                  dataInicio={escalaSolicitadaExtra.dataInicio}
                                  dataFim={escalaSolicitadaExtra.dataFim}
                                  limite={item.diasOferecidos.length}
                                />
                              )}
                            </>
                          }
                        />
                      </div>
                    )
                  })}

                  <button type="button" className="btn-secondary" onClick={onAdicionarItemExtraTroca}>
                    ➕ Adicionar outro dia/período
                  </button>
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
