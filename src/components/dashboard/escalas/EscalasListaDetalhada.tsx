'use client'

import { useState } from 'react'
import { EQUIPES } from '../../../lib/equipesConfig'
import { TIPOS_ESCALA } from '../../../lib/escalasConstants'
import type { Escala, Usuario } from '../../../types/dominio'

export default function EscalasListaDetalhada({
  escalas,
  usuarios,
  getNomeTecnico,
  podeEditarEscala,
  onEditarEscala,
  onDeletarEscala,
  onAtualizarEscalas,
}: {
  escalas: Escala[]
  usuarios: Usuario[]
  getNomeTecnico: (uid: string) => string
  podeEditarEscala: (escala: Escala) => boolean
  onEditarEscala: (escala: Escala) => void
  onDeletarEscala: (id: string) => void
  onAtualizarEscalas: () => Promise<void> | void
}) {
  const [filterTecnico, setFilterTecnico] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')
  const [filtrosAplicados, setFiltrosAplicados] = useState({
    tecnico: '',
    tipo: 'todos',
    dataInicio: '',
    dataFim: '',
  })
  const [selecionadasParaExcluir, setSelecionadasParaExcluir] = useState<string[]>([])
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [progressoExclusao, setProgressoExclusao] = useState<{ total: number; concluidas: number } | null>(null) // { total, concluidas } enquanto está apagando
  const [resultadoExclusao, setResultadoExclusao] = useState<{ total: number; falhas: number } | null>(null) // { total, falhas } por alguns segundos, no final

  const aplicarFiltros = () => {
    setFiltrosAplicados({
      tecnico: filterTecnico,
      tipo: filterTipo,
      dataInicio: filterDataInicio,
      dataFim: filterDataFim
    })
    console.log('🔍 Filtros aplicados:', {
      tecnico: filterTecnico,
      tipo: filterTipo,
      dataInicio: filterDataInicio,
      dataFim: filterDataFim
    })
  }

  const limparFiltros = () => {
    setFilterTecnico('')
    setFilterTipo('todos')
    setFilterDataInicio('')
    setFilterDataFim('')
    setFiltrosAplicados({
      tecnico: '',
      tipo: 'todos',
      dataInicio: '',
      dataFim: ''
    })
  }

  const escalasComBusca = escalas.filter(e => {
    // Filtro por técnico (SÓ se aplicado)
    const matchTecnico = !filtrosAplicados.tecnico ||
      (e.tecnicos && e.tecnicos[0] === filtrosAplicados.tecnico)

    // Filtro por tipo (SÓ se aplicado)
    const matchTipo = filtrosAplicados.tipo === 'todos' || e.tipo === filtrosAplicados.tipo

    // Filtro por período de data (SÓ se aplicado)
    let matchData = true
    if (filtrosAplicados.dataInicio || filtrosAplicados.dataFim) {
      const dataInicio = filtrosAplicados.dataInicio ? new Date(filtrosAplicados.dataInicio) : null
      const dataFim = filtrosAplicados.dataFim ? new Date(filtrosAplicados.dataFim) : null

      const escalaInicio = new Date(e.dataInicio)

      if (dataInicio && dataFim) {
        matchData = escalaInicio >= dataInicio && escalaInicio <= dataFim
      } else if (dataInicio) {
        matchData = escalaInicio >= dataInicio
      } else if (dataFim) {
        matchData = escalaInicio <= dataFim
      }
    }

    return matchTecnico && matchTipo && matchData
  })

  const escalasEditaveisVisiveis = escalasComBusca.filter(e => podeEditarEscala(e))
  const todasVisiveisSelecionadas = escalasEditaveisVisiveis.length > 0 &&
    escalasEditaveisVisiveis.every(e => selecionadasParaExcluir.includes(e.id))

  const toggleSelecionarTodasVisiveis = () => {
    if (todasVisiveisSelecionadas) {
      const idsVisiveis = new Set(escalasEditaveisVisiveis.map(e => e.id))
      setSelecionadasParaExcluir(prev => prev.filter(id => !idsVisiveis.has(id)))
    } else {
      setSelecionadasParaExcluir(prev => [...new Set([...prev, ...escalasEditaveisVisiveis.map(e => e.id)])])
    }
  }

  const toggleSelecaoEscala = (id: string) => {
    setSelecionadasParaExcluir(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Manda o lote inteiro numa única requisição (o servidor apaga tudo numa
  // consulta só) — bem mais rápido que uma requisição por escala. Só
  // divide em pedaços pra não mandar um corpo gigante de uma vez e pra
  // conseguir atualizar a contagem na notificação flutuante conforme avança.
  const TAMANHO_LOTE_EXCLUSAO = 250

  const pedirConfirmacaoExclusao = () => {
    if (selecionadasParaExcluir.length === 0) return
    setConfirmandoExclusao(true)
  }

  const handleExcluirSelecionadas = async () => {
    setConfirmandoExclusao(false)
    const ids = [...selecionadasParaExcluir]
    const total = ids.length
    let concluidas = 0
    let falhas = 0
    setProgressoExclusao({ total, concluidas: 0 })

    for (let i = 0; i < ids.length; i += TAMANHO_LOTE_EXCLUSAO) {
      const lote = ids.slice(i, i + TAMANHO_LOTE_EXCLUSAO)
      try {
        const response = await fetch('/api/escalas/excluir-lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: lote }),
        })
        const data = await response.json().catch(() => ({}))
        if (response.ok) {
          falhas += data.falhas || 0
        } else {
          falhas += lote.length
        }
      } catch {
        falhas += lote.length
      }
      concluidas += lote.length
      setProgressoExclusao({ total, concluidas })
    }

    await onAtualizarEscalas()
    setSelecionadasParaExcluir([])
    setProgressoExclusao(null)
    setResultadoExclusao({ total, falhas })
    setTimeout(() => setResultadoExclusao(null), 6000)
  }

  return (
    <div className="escalas-list">
      <div className="escalas-list-header">
        <h3>📋 Escalas Detalhadas</h3>
        <div className="escalas-list-controls">
          <select
            value={filterTecnico}
            onChange={(e) => setFilterTecnico(e.target.value)}
            className="filter-select"
          >
            <option value="">👥 Todos os Técnicos</option>
            {usuarios
              .filter(u => u.role !== 'admin' && u.role !== 'gestor')
              .map(tecnico => (
                <option key={tecnico.uid} value={tecnico.uid}>
                  {tecnico.nome}
                </option>
              ))}
          </select>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="filter-select"
          >
            <option value="todos">📋 Todos os Tipos</option>
            {TIPOS_ESCALA.map(tipo => (
              <option key={tipo.id} value={tipo.id}>{tipo.label}</option>
            ))}
          </select>

          <div className="filter-date-range">
            <div className="filter-date-group">
              <label>De:</label>
              <input
                type="date"
                value={filterDataInicio}
                onChange={(e) => setFilterDataInicio(e.target.value)}
                className="filter-date-input"
              />
            </div>
            <div className="filter-date-separator">→</div>
            <div className="filter-date-group">
              <label>Até:</label>
              <input
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="filter-date-input"
              />
            </div>
          </div>

          <button className="btn-filter-apply" onClick={aplicarFiltros}>
            🔍 Aplicar
          </button>

          <button className="btn-filter-clear" onClick={limparFiltros}>
            ✕ Limpar
          </button>
        </div>
      </div>

      {escalasEditaveisVisiveis.length > 0 && (
        <div className="escalas-bulk-bar">
          <label className="escalas-bulk-checkbox">
            <input
              type="checkbox"
              checked={todasVisiveisSelecionadas}
              onChange={toggleSelecionarTodasVisiveis}
            />
            Selecionar todas as visíveis ({escalasEditaveisVisiveis.length})
          </label>
          <button
            className="btn-delete"
            disabled={selecionadasParaExcluir.length === 0}
            onClick={pedirConfirmacaoExclusao}
          >
            🗑️ Excluir Selecionadas ({selecionadasParaExcluir.length})
          </button>
        </div>
      )}

      <div className="escalas-list-container">
        {escalasComBusca.length === 0 ? (
          <p className="empty-state">Nenhuma escala para exibir</p>
        ) : (
          escalasComBusca.map(escala => {
            const tipo = TIPOS_ESCALA.find(t => t.id === escala.tipo)
            const equipe = EQUIPES.find(e => e.id === escala.equipe)
            const podeEditarItem = podeEditarEscala(escala)
            return (
              <div key={escala.id} className={`escala-card ${selecionadasParaExcluir.includes(escala.id) ? 'selecionada' : ''}`}>
                <div className="escala-card-header">
                  <div className="escala-card-titulo">
                    {podeEditarItem && (
                      <input
                        type="checkbox"
                        className="escala-card-checkbox"
                        checked={selecionadasParaExcluir.includes(escala.id)}
                        onChange={() => toggleSelecaoEscala(escala.id)}
                      />
                    )}
                    <div>
                      <h4>{escala.descricao || 'Escala sem descrição'}</h4>
                      <div className="escala-badges">
                        <span className="badge" style={{ backgroundColor: tipo?.cor }}>
                          {tipo?.label}
                        </span>
                        <span className="badge equipe">{equipe?.label}</span>
                        <span className={`badge status ${escala.status}`}>
                          {escala.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="escala-actions">
                    {podeEditarItem ? (
                      <>
                        <button className="btn-edit" onClick={() => onEditarEscala(escala)}>
                          ✏️ Editar
                        </button>
                        <button className="btn-delete" onClick={() => onDeletarEscala(escala.id)}>
                          🗑️ Deletar
                        </button>
                      </>
                    ) : (
                      <button className="btn-edit" onClick={() => onEditarEscala(escala)}>
                        👁️ Ver
                      </button>
                    )}
                  </div>
                </div>
                <div className="escala-info">
                  <p>
                    <strong>📅 Período:</strong> {new Date(escala.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(escala.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                  {escala.tecnicos && escala.tecnicos.length > 0 && (
                    <div className="escala-tecnicos">
                      <strong>👥 Técnico:</strong>
                      <div className="tecnicos-badges">
                        {(Array.isArray(escala.tecnicos) ? escala.tecnicos : [escala.tecnicos]).map((tecnicoId, idx) => (
                          <span key={idx} className="tecnico-badge">
                            {getNomeTecnico(tecnicoId)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {confirmandoExclusao && (
        <div className="confirm-overlay" onClick={() => setConfirmandoExclusao(false)}>
          <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
            <h4>Excluir {selecionadasParaExcluir.length} escala(s)?</h4>
            <p>Essa ação não pode ser desfeita.</p>
            <div className="confirm-acoes">
              <button type="button" className="btn-secondary" onClick={() => setConfirmandoExclusao(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-delete" onClick={handleExcluirSelecionadas}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {progressoExclusao && (
        <div className="notificacao-flutuante">
          <strong>🗑️ Excluindo escalas...</strong>
          <span>{progressoExclusao.concluidas}/{progressoExclusao.total}</span>
          <div className="notificacao-flutuante-barra">
            <div
              className="notificacao-flutuante-barra-preenchida"
              style={{ width: `${(progressoExclusao.concluidas / progressoExclusao.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {resultadoExclusao && (
        <div className="notificacao-flutuante">
          <strong>{resultadoExclusao.falhas > 0 ? '⚠️ Concluído com falhas' : '✅ Concluído'}</strong>
          <span>
            {resultadoExclusao.falhas > 0
              ? `${resultadoExclusao.total - resultadoExclusao.falhas} escala(s) excluída(s). ${resultadoExclusao.falhas} falharam.`
              : `${resultadoExclusao.total} escala(s) excluída(s) com sucesso!`}
          </span>
          <button type="button" className="notificacao-flutuante-fechar" onClick={() => setResultadoExclusao(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
