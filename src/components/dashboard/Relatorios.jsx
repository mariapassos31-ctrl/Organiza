'use client'

import { useState, useEffect } from 'react'
import { Calendar, CheckCircle2, Users, UserCheck, Clock, Repeat, Inbox } from 'lucide-react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import { EQUIPES } from '../../lib/equipesConfig'
import '../../styles/Relatorios.css'

const TIPOS_ESCALA = [
  { id: 'presencial', label: '🏢 Presencial', cor: '#3498db' },
  { id: 'homeoffice', label: '🏠 Home Office', cor: '#2ecc71' },
  { id: 'sabado', label: '📅 Escala Sábado', cor: '#f39c12' },
  { id: 'sobreaviso', label: '🚨 Sobreaviso', cor: '#e74c3c' },
]
const TIPOS_ESCALA_MAP = Object.fromEntries(TIPOS_ESCALA.map(t => [t.id, t]))

const STATUS_TROCA_LABEL = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
}

export default function Relatorios() {
  const { userData } = useDashboardUser()
  const [escalas, setEscalas] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [trocas, setTrocas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEquipe, setFiltroEquipe] = useState('todas')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')

  const souGestor = userData?.role === 'gestor'

  useEffect(() => {
    Promise.all([
      fetch('/api/escalas').then(res => res.json()),
      fetch('/api/tecnicos').then(res => res.json()),
      fetch('/api/trocas').then(res => res.json()),
    ])
      .then(([escalasData, tecnicosData, trocasData]) => {
        setEscalas(Array.isArray(escalasData) ? escalasData : [])
        setTecnicos(Array.isArray(tecnicosData) ? tecnicosData : [])
        setTrocas(Array.isArray(trocasData) ? trocasData : [])
      })
      .catch(error => console.error('Erro ao carregar relatórios:', error))
      .finally(() => setLoading(false))
  }, [])

  const getNomeTecnico = (uid) => tecnicos.find(t => t.id === uid)?.nome || 'Desconhecido'

  // Gestor só pode ver dados da própria equipe: ignora o filtro e trava na equipe dele
  const equipeEfetiva = souGestor ? userData?.equipe : filtroEquipe

  const escalasFiltradas = escalas.filter(e => {
    if (equipeEfetiva && equipeEfetiva !== 'todas' && e.equipe !== equipeEfetiva) return false
    if (filtroDataInicio && e.dataFim < filtroDataInicio) return false
    if (filtroDataFim && e.dataInicio > filtroDataFim) return false
    return true
  })

  const tecnicosFiltrados = (equipeEfetiva && equipeEfetiva !== 'todas')
    ? tecnicos.filter(t => t.equipe === equipeEfetiva)
    : tecnicos

  const limparFiltros = () => {
    if (!souGestor) setFiltroEquipe('todas')
    setFiltroDataInicio('')
    setFiltroDataFim('')
  }

  const totalEscalas = escalasFiltradas.length
  const escalasAtivas = escalasFiltradas.filter(e => e.status === 'ativa').length
  const totalTecnicos = tecnicosFiltrados.length
  const tecnicosDisponiveis = tecnicosFiltrados.filter(t => t.disponivel).length
  const trocasPendentes = trocas.filter(t => t.status === 'pendente').length
  const trocasAceitas = trocas.filter(t => t.status === 'aceita').length

  const distribuicaoTecnico = tecnicosFiltrados
    .map(t => ({
      nome: t.nome,
      total: escalasFiltradas.filter(e => e.tecnicos?.includes(t.id)).length,
    }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)
  const maxPorTecnico = Math.max(1, ...distribuicaoTecnico.map(d => d.total))

  const distribuicaoTipo = TIPOS_ESCALA.map(tipo => ({
    ...tipo,
    total: escalasFiltradas.filter(e => e.tipo === tipo.id).length,
  }))
  const maxPorTipo = Math.max(1, ...distribuicaoTipo.map(d => d.total))

  const escalasRecentes = [...escalasFiltradas]
    .sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio))
    .slice(0, 8)

  const exportarCSV = () => {
    const linhas = [
      ['Tipo', 'Data Início', 'Data Fim', 'Equipe', 'Técnico(s)', 'Status'].join(';'),
      ...escalasFiltradas.map(e => [
        TIPOS_ESCALA_MAP[e.tipo]?.label || e.tipo,
        e.dataInicio,
        e.dataFim,
        e.equipe || '',
        (e.tecnicos || []).map(uid => getNomeTecnico(uid)).join(', '),
        e.status,
      ].join(';')),
    ]
    const csv = linhas.join('\n')
    const bom = String.fromCharCode(0xFEFF)
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-escalas-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const EstadoVazio = ({ texto }) => (
    <div className="empty">
      <Inbox size={28} />
      <p>{texto}</p>
    </div>
  )

  if (loading) {
    return <div className="relatorios-container"><p className="empty">Carregando relatórios...</p></div>
  }

  return (
    <div className="relatorios-container">
      <div className="relatorios-header">
        <div>
          <h2>📈 Relatórios</h2>
          <p className="subtitle">
            {userData?.role === 'gestor'
              ? `Visão geral da equipe ${userData?.equipe?.toUpperCase()}`
              : 'Visão geral de todas as equipes'}
          </p>
        </div>
        <button className="btn-export" onClick={exportarCSV}>⬇️ Exportar CSV</button>
      </div>

      <div className="relatorio-filtros">
        <div className="filtro-grupo">
          <label>Equipe</label>
          {souGestor ? (
            <select value={equipeEfetiva || ''} disabled>
              <option value={equipeEfetiva || ''}>
                {EQUIPES.find(eq => eq.id === equipeEfetiva)?.label || equipeEfetiva?.toUpperCase()}
              </option>
            </select>
          ) : (
            <select value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)}>
              <option value="todas">Todas as equipes</option>
              {EQUIPES.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.label}</option>
              ))}
            </select>
          )}
        </div>
        <div className="filtro-grupo">
          <label>De</label>
          <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
        </div>
        <div className="filtro-grupo">
          <label>Até</label>
          <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
        </div>
        <button className="btn-limpar-filtros" onClick={limparFiltros}>✕ Limpar</button>
      </div>

      <div className="metricas-grid">
        <div className="metrica-card" style={{ borderLeftColor: 'var(--brand-primary)' }}>
          <div className="metrica-icone" style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' }}>
            <Calendar size={18} />
          </div>
          <h3>Total de Escalas</h3>
          <p className="numero" style={{ color: 'var(--brand-primary)' }}>{totalEscalas}</p>
          <span className="label">No período filtrado</span>
        </div>

        <div className="metrica-card" style={{ borderLeftColor: '#27ae60' }}>
          <div className="metrica-icone" style={{ background: '#e8f8ef', color: '#27ae60' }}>
            <CheckCircle2 size={18} />
          </div>
          <h3>Escalas Ativas</h3>
          <p className="numero" style={{ color: '#27ae60' }}>{escalasAtivas}</p>
          <span className="label">Em operação</span>
        </div>

        <div className="metrica-card" style={{ borderLeftColor: 'var(--brand-primary)' }}>
          <div className="metrica-icone" style={{ background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)' }}>
            <Users size={18} />
          </div>
          <h3>Total de Técnicos</h3>
          <p className="numero" style={{ color: 'var(--brand-primary)' }}>{totalTecnicos}</p>
          <span className="label">Profissionais cadastrados</span>
        </div>

        <div className="metrica-card" style={{ borderLeftColor: '#27ae60' }}>
          <div className="metrica-icone" style={{ background: '#e8f8ef', color: '#27ae60' }}>
            <UserCheck size={18} />
          </div>
          <h3>Técnicos Disponíveis</h3>
          <p className="numero" style={{ color: '#27ae60' }}>{tecnicosDisponiveis}</p>
          <span className="label">Prontos para escala</span>
        </div>

        <div className="metrica-card" style={{ borderLeftColor: '#f39c12' }}>
          <div className="metrica-icone" style={{ background: '#fff4e0', color: '#f39c12' }}>
            <Clock size={18} />
          </div>
          <h3>Trocas Pendentes</h3>
          <p className="numero" style={{ color: '#f39c12' }}>{trocasPendentes}</p>
          <span className="label">Aguardando resposta</span>
        </div>

        <div className="metrica-card" style={{ borderLeftColor: '#27ae60' }}>
          <div className="metrica-icone" style={{ background: '#e8f8ef', color: '#27ae60' }}>
            <Repeat size={18} />
          </div>
          <h3>Trocas Aceitas</h3>
          <p className="numero" style={{ color: '#27ae60' }}>{trocasAceitas}</p>
          <span className="label">Realizadas com sucesso</span>
        </div>
      </div>

      <div className="relatorio-duas-colunas">
        <div className="relatorio-section">
          <h3>👥 Escalas por Técnico</h3>
          {distribuicaoTecnico.length === 0 ? (
            <EstadoVazio texto="Nenhuma escala no período filtrado" />
          ) : (
            <div className="barras-lista">
              {distribuicaoTecnico.map(d => (
                <div key={d.nome} className="barra-item">
                  <span className="barra-label">{d.nome}</span>
                  <div className="barra-trilha">
                    <div className="barra-preenchimento" style={{ width: `${(d.total / maxPorTecnico) * 100}%`, background: 'var(--brand-primary)' }} />
                  </div>
                  <span className="barra-valor">{d.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relatorio-section">
          <h3>🗂️ Escalas por Tipo</h3>
          {totalEscalas === 0 ? (
            <EstadoVazio texto="Nenhuma escala no período filtrado" />
          ) : (
            <div className="barras-lista">
              {distribuicaoTipo.map(t => (
                <div key={t.id} className="barra-item">
                  <span className="barra-label">{t.label}</span>
                  <div className="barra-trilha">
                    <div className="barra-preenchimento" style={{ width: `${(t.total / maxPorTipo) * 100}%`, background: t.cor }} />
                  </div>
                  <span className="barra-valor">{t.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relatorio-section">
        <h3>🔄 Trocas Recentes</h3>
        {trocas.length === 0 ? (
          <EstadoVazio texto="Nenhuma troca registrada" />
        ) : (
          <div className="relatorio-table-wrapper">
            <table className="relatorio-table">
              <thead>
                <tr>
                  <th>Solicitante</th>
                  <th>Destino</th>
                  <th>Tipo</th>
                  <th>Equipe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trocas.slice(0, 5).map(troca => (
                  <tr key={troca.id}>
                    <td>{troca.solicitanteNome}</td>
                    <td>{troca.destinoNome || '-'}</td>
                    <td>{troca.dia ? 'Um dia' : 'Escala inteira'}</td>
                    <td>{troca.equipe?.toUpperCase()}</td>
                    <td><span className={`status troca-${troca.status}`}>{STATUS_TROCA_LABEL[troca.status] || troca.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="relatorio-section">
        <h3>📅 Escalas Recentes</h3>
        {escalasRecentes.length === 0 ? (
          <EstadoVazio texto="Nenhuma escala cadastrada" />
        ) : (
          <div className="relatorio-table-wrapper">
            <table className="relatorio-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Período</th>
                  <th>Equipe</th>
                  <th>Técnico(s)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {escalasRecentes.map(escala => (
                  <tr key={escala.id}>
                    <td>{TIPOS_ESCALA_MAP[escala.tipo]?.label || escala.tipo}</td>
                    <td>
                      {new Date(escala.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                      {' a '}
                      {new Date(escala.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td>{escala.equipe?.toUpperCase() || '-'}</td>
                    <td>{(escala.tecnicos || []).map(uid => getNomeTecnico(uid)).join(', ') || '-'}</td>
                    <td><span className={`status ${escala.status}`}>{escala.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="relatorio-section">
        <h3>🧑‍💻 Técnicos Cadastrados</h3>
        {tecnicosFiltrados.length === 0 ? (
          <EstadoVazio texto="Nenhum técnico cadastrado" />
        ) : (
          <div className="relatorio-table-wrapper">
            <table className="relatorio-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Equipe</th>
                  <th>Especialidade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tecnicosFiltrados.map(tecnico => (
                  <tr key={tecnico.id}>
                    <td>{tecnico.nome}</td>
                    <td>{tecnico.email}</td>
                    <td>{tecnico.equipe?.toUpperCase() || '-'}</td>
                    <td>{tecnico.especialidade || '-'}</td>
                    <td>
                      <span className={`disponibilidade ${tecnico.disponivel ? 'disponivel' : 'indisponivel'}`}>
                        {tecnico.disponivel ? 'Disponível' : 'Indisponível'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
