'use client'

import { useState, useEffect } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import '../../styles/MinhaAgenda.css'

const TIPOS_ESCALA = {
  presencial: '🏢 Presencial',
  homeoffice: '🏠 Home Office',
  sabado: '📅 Escala Sábado',
  sobreaviso: '🚨 Sobreaviso',
}

export default function MinhaAgenda() {
  const { user, userData } = useDashboardUser()
  const [usuarios, setUsuarios] = useState([])
  const [escalasFiltradas, setEscalasFiltradas] = useState([])
  const [mesAtual, setMesAtual] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [escalaSelecionada, setEscalaSelecionada] = useState(null)
  const [mostrarFormTroca, setMostrarFormTroca] = useState(false)
  const [tipoTroca, setTipoTroca] = useState('completa')
  const [diaTroca, setDiaTroca] = useState('')
  const [destinoTroca, setDestinoTroca] = useState('')
  const [enviandoTroca, setEnviandoTroca] = useState(false)

  useEffect(() => {
    if (!user || !userData) {
      setLoading(false)
      return
    }

    let cancelled = false

    const carregar = async () => {
      try {
        const [usuariosRes, escalasRes] = await Promise.all([
          fetch('/api/usuarios'),
          fetch('/api/escalas'),
        ])
        const usuariosData = await usuariosRes.json()
        const escalasData = await escalasRes.json()

        if (cancelled) return

        setUsuarios(usuariosData)

        let escalasCorretas = []
        if (userData.role === 'admin') {
          escalasCorretas = escalasData
        } else if (userData.role === 'gestor') {
          // Gestor: escalas de toda a equipe
          escalasCorretas = escalasData.filter(e => e.equipe === userData.equipe)
        } else {
          // Qualquer colaborador (técnico, analista, desenvolvedor, ou perfil
          // livre): só a própria escala pessoal
          escalasCorretas = escalasData.filter(e => e.tecnicos?.includes(user.uid))
        }

        setEscalasFiltradas(escalasCorretas)
      } catch (error) {
        console.error('Erro ao carregar agenda:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    carregar()

    return () => {
      cancelled = true
    }
  }, [user, userData])

  const getNomeUsuario = (uid) => usuarios.find(u => u.uid === uid)?.nome || 'Desconhecido'

  const souTecnico = userData?.role !== 'admin' && userData?.role !== 'gestor'

  const colegasParaTroca = usuarios.filter(u =>
    u.equipe === userData?.equipe &&
    u.role !== 'admin' && u.role !== 'gestor' &&
    u.uid !== user?.uid &&
    u.ativo
  )

  const abrirEscala = (escala) => {
    setEscalaSelecionada(escala)
    setMostrarFormTroca(false)
    setTipoTroca('completa')
    setDiaTroca('')
    setDestinoTroca('')
  }

  const fecharModal = () => {
    setEscalaSelecionada(null)
    setMostrarFormTroca(false)
  }

  const enviarSolicitacaoTroca = async () => {
    if (!destinoTroca) {
      alert('Selecione o colega com quem deseja trocar')
      return
    }
    if (tipoTroca === 'dia' && !diaTroca) {
      alert('Selecione o dia que deseja trocar')
      return
    }
    setEnviandoTroca(true)
    try {
      const res = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalaId: escalaSelecionada.id,
          tecnicoDestinoUid: destinoTroca,
          dia: tipoTroca === 'dia' ? diaTroca : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao solicitar a troca')
      }
      alert('Solicitação de troca enviada! Acompanhe em "Trocas".')
      fecharModal()
    } catch (error) {
      alert(error.message)
    } finally {
      setEnviandoTroca(false)
    }
  }

  // Gerar calendário do mês
  const gerarCalendario = () => {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)
    const diasDoMes = ultimoDia.getDate()
    const diaInicio = primeiroDia.getDay()

    const dias = []

    for (let i = 0; i < diaInicio; i++) {
      dias.push(null)
    }

    for (let i = 1; i <= diasDoMes; i++) {
      dias.push(new Date(ano, mes, i))
    }

    return dias
  }

  const obterEscalasDoDia = (data) => {
    if (!data) return []
    return escalasFiltradas.filter(escala => {
      const inicio = new Date(escala.dataInicio + 'T00:00:00')
      const fim = new Date(escala.dataFim + 'T00:00:00')
      return data >= inicio && data <= fim
    })
  }

  const mudarMes = (direcao) => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + direcao, 1))
  }

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const escalasOrdenadas = [...escalasFiltradas].sort(
    (a, b) => new Date(a.dataInicio) - new Date(b.dataInicio)
  )
  const proximaEscala = escalasOrdenadas.find(e => new Date(e.dataFim + 'T00:00:00') >= hoje)

  const diasCalendario = gerarCalendario()
  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const nomesDosSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="minha-agenda-container">
      <div className="agenda-header">
        <h2>📅 Minha Agenda</h2>
        <p className="agenda-subtitle">
          {userData?.role === 'admin'
            ? 'Todas as escalas'
            : userData?.role === 'gestor'
            ? `Escalas da equipe ${userData?.equipe?.toUpperCase()}`
            : 'Visualize seus dias escalados'}
        </p>
      </div>

      {/* RESUMO */}
      <div className="agenda-stats">
        <div className="stat-card">
          <span className="stat-label">Total de Escalas</span>
          <span className="stat-number">{escalasFiltradas.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Próxima Escala</span>
          <span className="stat-number">
            {proximaEscala
              ? new Date(proximaEscala.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')
              : 'Nenhuma'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Equipe</span>
          <span className="stat-number">{userData?.equipe?.toUpperCase() || 'N/A'}</span>
        </div>
      </div>

      {/* CALENDÁRIO */}
      <div className="calendario-wrapper">
        <div className="calendario-header">
          <button onClick={() => mudarMes(-1)} className="btn-nav">◀ Anterior</button>
          <h3>{nomesMeses[mesAtual.getMonth()]} {mesAtual.getFullYear()}</h3>
          <button onClick={() => mudarMes(1)} className="btn-nav">Próximo ▶</button>
        </div>

        <div className="calendario-dias-semana">
          {nomesDosSemana.map(dia => (
            <div key={dia} className="dia-semana-header">{dia}</div>
          ))}
        </div>

        <div className="calendario-grid">
          {diasCalendario.map((data, index) => {
            const escalasDodia = obterEscalasDoDia(data)
            const escalado = escalasDodia.length > 0

            return (
              <div
                key={index}
                className={`calendario-dia ${!data ? 'vazio' : ''} ${escalado ? 'escalado' : ''}`}
              >
                {data && (
                  <>
                    <div className="dia-numero">{data.getDate()}</div>
                    {escalado && (
                      <div className="dia-status">
                        <span className="badge-escalado">✓</span>
                        {escalasDodia.map((escala, i) => (
                          <div
                            key={i}
                            className="escala-info"
                            onClick={() => abrirEscala(escala)}
                            title="Clique para ver detalhes"
                          >
                            <span className="escala-info-nome">
                              {(escala.tecnicos || []).map(uid => getNomeUsuario(uid)).join(', ') || 'Sem técnico'}
                            </span>
                            <span className="escala-info-tipo">{TIPOS_ESCALA[escala.tipo] || escala.tipo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* LISTA DE ESCALAS */}
      <div className="escalas-lista">
        <h3>📋 Escalas</h3>
        {escalasOrdenadas.length > 0 ? (
          <div className="escalas-table-wrapper">
            <table className="escalas-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Tipo</th>
                  <th>Técnico</th>
                  <th>Equipe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {escalasOrdenadas.map(escala => (
                  <tr
                    key={escala.id}
                    className="escala-row-clicavel"
                    onClick={() => abrirEscala(escala)}
                    title="Clique para ver detalhes"
                  >
                    <td>
                      {new Date(escala.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                      {' a '}
                      {new Date(escala.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td>{TIPOS_ESCALA[escala.tipo] || escala.tipo}</td>
                    <td className="nome-cell">
                      {(escala.tecnicos || []).map(uid => getNomeUsuario(uid)).join(', ') || 'Ninguém'}
                    </td>
                    <td>{escala.equipe?.toUpperCase()}</td>
                    <td>
                      <span className={`status-badge ${escala.status === 'ativa' ? 'ativa' : 'finalizada'}`}>
                        {escala.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>📭 Nenhuma escala agendada</p>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES (SOMENTE LEITURA) */}
      {escalaSelecionada && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes da Escala</h3>
              <button className="modal-close" onClick={fecharModal}>✕</button>
            </div>
            <div className="escala-detalhe-modal">
              <div className="escala-detalhe-linha">
                <strong>Tipo</strong>
                <span>{TIPOS_ESCALA[escalaSelecionada.tipo] || escalaSelecionada.tipo}</span>
              </div>
              <div className="escala-detalhe-linha">
                <strong>Período</strong>
                <span>
                  {new Date(escalaSelecionada.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                  {' a '}
                  {new Date(escalaSelecionada.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="escala-detalhe-linha">
                <strong>Equipe</strong>
                <span>{escalaSelecionada.equipe?.toUpperCase()}</span>
              </div>
              <div className="escala-detalhe-linha">
                <strong>Técnico(s)</strong>
                <span>
                  {(escalaSelecionada.tecnicos || []).map(uid => getNomeUsuario(uid)).join(', ') || 'Ninguém'}
                </span>
              </div>
              <div className="escala-detalhe-linha">
                <strong>Status</strong>
                <span className={`status-badge ${escalaSelecionada.status === 'ativa' ? 'ativa' : 'finalizada'}`}>
                  {escalaSelecionada.status}
                </span>
              </div>
              {escalaSelecionada.descricao && (
                <div className="escala-detalhe-linha escala-detalhe-descricao">
                  <strong>Descrição</strong>
                  <span>{escalaSelecionada.descricao}</span>
                </div>
              )}
              {escalaSelecionada.criadoPor && (
                <div className="escala-detalhe-linha">
                  <strong>Criado por</strong>
                  <span>{escalaSelecionada.criadoPor}</span>
                </div>
              )}
            </div>

            {souTecnico && mostrarFormTroca && (
              <div className="troca-form">
                <div className="escala-detalhe-linha">
                  <strong>O que deseja trocar?</strong>
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
                  <div className="escala-detalhe-linha">
                    <strong>Qual dia?</strong>
                    <input
                      type="date"
                      value={diaTroca}
                      min={escalaSelecionada.dataInicio}
                      max={escalaSelecionada.dataFim}
                      onChange={(e) => setDiaTroca(e.target.value)}
                    />
                  </div>
                )}
                <div className="escala-detalhe-linha">
                  <strong>Trocar com quem?</strong>
                  <select value={destinoTroca} onChange={(e) => setDestinoTroca(e.target.value)}>
                    <option value="">Selecione um colega...</option>
                    {colegasParaTroca.map(colega => (
                      <option key={colega.uid} value={colega.uid}>{colega.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="form-actions-modal">
              {souTecnico && !mostrarFormTroca && (
                <button type="button" className="btn-success" onClick={() => setMostrarFormTroca(true)}>
                  🔄 Solicitar Troca
                </button>
              )}
              {souTecnico && mostrarFormTroca && (
                <button type="button" className="btn-success" disabled={enviandoTroca} onClick={enviarSolicitacaoTroca}>
                  {enviandoTroca ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={mostrarFormTroca ? () => setMostrarFormTroca(false) : fecharModal}>
                {mostrarFormTroca ? 'Voltar' : 'Fechar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
