'use client'

import { useState, useEffect } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import '../../styles/Trocas.css'

const TIPOS_ESCALA = {
  presencial: '🏢 Presencial',
  homeoffice: '🏠 Home Office',
  sabado: '📅 Escala Sábado',
  sobreaviso: '🚨 Sobreaviso',
}

const STATUS_LABEL = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
}

export default function Trocas() {
  const { user, userData } = useDashboardUser()
  const [trocas, setTrocas] = useState([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState(null)

  const carregar = async () => {
    try {
      const res = await fetch('/api/trocas')
      const data = await res.json()
      setTrocas(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao carregar trocas:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userData) return
    carregar()
  }, [userData])

  const responder = async (id, acao) => {
    setProcessando(id)
    try {
      const res = await fetch(`/api/trocas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao processar a solicitação')
      }
      await carregar()
    } catch (error) {
      alert(error.message)
    } finally {
      setProcessando(null)
    }
  }

  const formatPeriodo = (troca) => {
    if (troca.dia) {
      return new Date(troca.dia + 'T00:00:00').toLocaleDateString('pt-BR')
    }
    return `${new Date(troca.escalaDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(troca.escalaDataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`
  }

  const formatPeriodoSolicitada = (troca) =>
    `${TIPOS_ESCALA[troca.escalaSolicitadaTipo] || troca.escalaSolicitadaTipo} · ${new Date(troca.escalaSolicitadaDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(troca.escalaSolicitadaDataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`

  const souTecnico = userData?.role !== 'admin' && userData?.role !== 'gestor'

  const recebidas = souTecnico
    ? trocas.filter(t => t.destinoUid === user?.uid && t.status === 'pendente')
    : []
  const recebidasHistorico = souTecnico
    ? trocas.filter(t => t.destinoUid === user?.uid && t.status !== 'pendente')
    : []
  const minhas = souTecnico
    ? trocas.filter(t => t.solicitanteUid === user?.uid)
    : []
  const visaoGeral = !souTecnico ? trocas : []

  if (loading) {
    return <div className="trocas-container"><p>Carregando...</p></div>
  }

  return (
    <div className="trocas-container">
      <div className="trocas-header">
        <h2>🔄 Trocas de Escala</h2>
        <p className="subtitle">
          {souTecnico
            ? 'Solicite trocas com colegas da sua equipe e responda aos pedidos que você recebeu'
            : userData?.role === 'gestor'
            ? `Acompanhamento das trocas da equipe ${userData?.equipe?.toUpperCase()}`
            : 'Acompanhamento de todas as trocas'}
        </p>
      </div>

      {souTecnico && (
        <div className="trocas-secao">
          <h3>📥 Solicitações Recebidas</h3>
          {recebidas.length === 0 ? (
            <p className="empty-state">Nenhuma solicitação pendente</p>
          ) : (
            <div className="trocas-lista">
              {recebidas.map(troca => (
                <div key={troca.id} className="troca-card">
                  <div className="troca-info">
                    <p>
                      <strong>{troca.solicitanteNome}</strong>{' '}
                      {troca.escalaSolicitadaId
                        ? <>quer trocar a escala dele(a) pela <strong>sua</strong> escala de {formatPeriodoSolicitada(troca)}</>
                        : <>quer trocar {troca.dia ? 'o dia' : 'a escala inteira'} com você</>}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && 'Oferece em troca: '}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                  </div>
                  <div className="troca-actions">
                    <button
                      className="btn-success"
                      disabled={processando === troca.id}
                      onClick={() => responder(troca.id, 'aceitar')}
                    >
                      ✅ Aceitar
                    </button>
                    <button
                      className="btn-delete"
                      disabled={processando === troca.id}
                      onClick={() => responder(troca.id, 'recusar')}
                    >
                      ❌ Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {souTecnico && (
        <div className="trocas-secao">
          <h3>🗂️ Histórico de Solicitações Recebidas</h3>
          {recebidasHistorico.length === 0 ? (
            <p className="empty-state">Nenhuma solicitação respondida ainda</p>
          ) : (
            <div className="trocas-lista">
              {recebidasHistorico.map(troca => (
                <div key={troca.id} className="troca-card">
                  <div className="troca-info">
                    <p>
                      <strong>{troca.solicitanteNome}</strong>{' '}
                      {troca.escalaSolicitadaId
                        ? <>pediu para trocar a escala dele(a) pela <strong>sua</strong> escala de {formatPeriodoSolicitada(troca)}</>
                        : <>pediu para trocar {troca.dia ? 'o dia' : 'a escala inteira'} com você</>}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && 'Ofereceu em troca: '}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                  </div>
                  <span className={`status-badge troca-status-${troca.status}`}>{STATUS_LABEL[troca.status] || troca.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {souTecnico && (
        <div className="trocas-secao">
          <h3>📤 Minhas Solicitações</h3>
          {minhas.length === 0 ? (
            <p className="empty-state">Você ainda não solicitou nenhuma troca</p>
          ) : (
            <div className="trocas-lista">
              {minhas.map(troca => (
                <div key={troca.id} className="troca-card">
                  <div className="troca-info">
                    <p>
                      {troca.escalaSolicitadaId ? 'Proposta de troca' : 'Troca'} com <strong>{troca.destinoNome}</strong>
                      {!troca.escalaSolicitadaId && <> · {troca.dia ? 'o dia' : 'a escala inteira'}</>}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && 'Você oferece: '}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                    {troca.escalaSolicitadaId && (
                      <p className="troca-detalhe">Você pede: {formatPeriodoSolicitada(troca)}</p>
                    )}
                  </div>
                  <div className="troca-actions">
                    <span className={`status-badge troca-status-${troca.status}`}>{STATUS_LABEL[troca.status] || troca.status}</span>
                    {troca.status === 'pendente' && (
                      <button
                        className="btn-secondary"
                        disabled={processando === troca.id}
                        onClick={() => responder(troca.id, 'cancelar')}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!souTecnico && (
        <div className="trocas-secao">
          <h3>📋 {userData?.role === 'gestor' ? 'Trocas da Equipe' : 'Todas as Trocas'}</h3>
          {visaoGeral.length === 0 ? (
            <p className="empty-state">Nenhuma troca registrada</p>
          ) : (
            <div className="trocas-lista">
              {visaoGeral.map(troca => (
                <div key={troca.id} className="troca-card">
                  <div className="troca-info">
                    <p>
                      <strong>{troca.solicitanteNome}</strong> → <strong>{troca.destinoNome}</strong>
                      {!troca.escalaSolicitadaId && <> · {troca.dia ? 'um dia' : 'escala inteira'}</>}
                      {troca.escalaSolicitadaId && ' · troca mútua'}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && `${troca.solicitanteNome} oferece: `}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                    {troca.escalaSolicitadaId && (
                      <p className="troca-detalhe">{troca.solicitanteNome} pede: {formatPeriodoSolicitada(troca)}</p>
                    )}
                  </div>
                  <span className={`status-badge troca-status-${troca.status}`}>{STATUS_LABEL[troca.status] || troca.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
