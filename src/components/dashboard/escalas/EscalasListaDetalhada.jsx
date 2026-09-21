'use client'

import { useState } from 'react'
import { EQUIPES } from '../../../lib/equipesConfig'
import { TIPOS_ESCALA } from '../../../lib/escalasConstants'

export default function EscalasListaDetalhada({
  escalas,
  usuarios,
  getNomeTecnico,
  podeEditarEscala,
  onEditarEscala,
  onDeletarEscala,
  onAtualizarEscalas,
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
  const [selecionadasParaExcluir, setSelecionadasParaExcluir] = useState([])

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

  const toggleSelecaoEscala = (id) => {
    setSelecionadasParaExcluir(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleExcluirSelecionadas = async () => {
    if (selecionadasParaExcluir.length === 0) return
    if (!window.confirm(`Tem certeza que deseja excluir ${selecionadasParaExcluir.length} escala(s)? Essa ação não pode ser desfeita.`)) {
      return
    }
    const resultados = await Promise.all(
      selecionadasParaExcluir.map(id =>
        fetch(`/api/escalas/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.ok)
      )
    )
    const falhas = resultados.filter(ok => !ok).length
    await onAtualizarEscalas()
    setSelecionadasParaExcluir([])
    alert(falhas > 0
      ? `${resultados.length - falhas} escala(s) excluída(s). ${falhas} falharam (permissão ou já removidas).`
      : `${resultados.length} escala(s) excluída(s) com sucesso!`)
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
            onClick={handleExcluirSelecionadas}
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
    </div>
  )
}
