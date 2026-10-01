'use client'

import { useState, useEffect } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import { useNotificacao } from '../../context/NotificacaoContext'
import { mensagemDeErro } from '../../lib/erros'
import type { Troca } from '../../types/dominio'
import '../../styles/Trocas.css'

const TIPOS_ESCALA: Record<string, string> = {
  presencial: '🏢 Presencial',
  homeoffice: '🏠 Home Office',
  sabado: '📅 Escala Sábado',
  sobreaviso: '🚨 Sobreaviso',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
}

export default function Trocas() {
  const { user, userData } = useDashboardUser()
  const { notificar } = useNotificacao()
  const [trocas, setTrocas] = useState<Troca[]>([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  // Vem do botão "Ver troca"/"Ver pedido de troca" do e-mail de notificação
  // (?trocaId=...) — não sabemos em qual das 4 listas a troca vai cair, só
  // depois de carregar; por isso o scroll+destaque roda num efeito à parte.
  const [trocaIdAlvo] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('trocaId') : null
  )

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

  useEffect(() => {
    if (!trocaIdAlvo || trocas.length === 0) return
    const el = document.getElementById(`troca-${trocaIdAlvo}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('troca-card-destacada')
    const timer = setTimeout(() => el.classList.remove('troca-card-destacada'), 3000)
    return () => clearTimeout(timer)
  }, [trocaIdAlvo, trocas])

  const responder = async (id: string, acao: string) => {
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
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setProcessando(null)
    }
  }

  // A escala já vem recortada do tamanho exato pedido (um dia, vários dias
  // ou o período inteiro) — não precisa mais de um campo à parte pra dizer
  // "foi só um dia": a própria data mostra isso (início = fim vira uma
  // data só; senão, o período completo).
  const formatPeriodo = (troca: Troca) => {
    if (troca.dia) {
      return new Date(troca.dia + 'T00:00:00').toLocaleDateString('pt-BR')
    }
    if (troca.escalaDataInicio === troca.escalaDataFim) {
      return new Date(troca.escalaDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')
    }
    return `${new Date(troca.escalaDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(troca.escalaDataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`
  }

  // Pra frase "quer trocar o dia / a escala inteira": olha o próprio
  // tamanho do período (já vem recortado certinho), com "dia" (campo
  // antigo) só como reforço pra pedidos de antes desse recorte existir.
  const ehUmDiaSo = (troca: Troca) => Boolean(troca.dia) || troca.escalaDataInicio === troca.escalaDataFim

  const formatPeriodoSolicitada = (troca: Troca) =>
    `${TIPOS_ESCALA[troca.escalaSolicitadaTipo ?? ""] || troca.escalaSolicitadaTipo} · ${new Date(troca.escalaSolicitadaDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(troca.escalaSolicitadaDataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`

  // Itens extras (ex: inverter dia 6 E dia 13 do mesmo revezamento numa
  // troca só) — mostra cada um no mesmo formato do item principal.
  const ItensExtras = ({ troca }: { troca: Troca }) => {
    if (!troca.itensExtras || troca.itensExtras.length === 0) return null
    return (
      <>
        {troca.itensExtras.map((item, i) => (
          <p key={i} className="troca-detalhe">
            + {item.escalaSolicitadaTipo && 'oferece '}
            {TIPOS_ESCALA[item.escalaTipo] || item.escalaTipo} · {new Date(item.escalaDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
            {item.escalaDataInicio !== item.escalaDataFim && ` a ${new Date(item.escalaDataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`}
            {item.escalaSolicitadaTipo && item.escalaSolicitadaDataInicio && item.escalaSolicitadaDataFim && (
              <> · pede {TIPOS_ESCALA[item.escalaSolicitadaTipo] || item.escalaSolicitadaTipo} · {new Date(item.escalaSolicitadaDataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
              {item.escalaSolicitadaDataInicio !== item.escalaSolicitadaDataFim && ` a ${new Date(item.escalaSolicitadaDataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`}</>
            )}
          </p>
        ))}
      </>
    )
  }

  // Líder vê as duas coisas: acompanha a equipe inteira (como gestor) E
  // participa da escala, então também pede/recebe troca pra si mesmo
  // (como técnico) — por isso as duas flags não são mutuamente exclusivas.
  const podeVerPropriaTroca = userData?.role !== 'admin' && userData?.role !== 'gestor'
  const podeVerVisaoGeral = userData?.role === 'admin' || userData?.role === 'gestor' || userData?.role === 'lider'

  const recebidas = podeVerPropriaTroca
    ? trocas.filter(t => t.destinoUid === user?.uid && t.status === 'pendente')
    : []
  const recebidasHistorico = podeVerPropriaTroca
    ? trocas.filter(t => t.destinoUid === user?.uid && t.status !== 'pendente')
    : []
  const minhas = podeVerPropriaTroca
    ? trocas.filter(t => t.solicitanteUid === user?.uid)
    : []
  const visaoGeral = podeVerVisaoGeral ? trocas : []

  if (loading) {
    return <div className="trocas-container"><p>Carregando...</p></div>
  }

  return (
    <div className="trocas-container">
      <div className="trocas-header">
        <h2>🔄 Trocas de Escala</h2>
        <p className="subtitle">
          {userData?.role === 'lider'
            ? `Solicite trocas com colegas e acompanhe as trocas da equipe ${userData?.equipe?.toUpperCase()}`
            : podeVerPropriaTroca
            ? 'Solicite trocas com colegas da sua equipe e responda aos pedidos que você recebeu'
            : userData?.role === 'gestor'
            ? `Acompanhamento das trocas da equipe ${userData?.equipe?.toUpperCase()}`
            : 'Acompanhamento de todas as trocas'}
        </p>
      </div>

      {podeVerPropriaTroca && (
        <div className="trocas-secao">
          <h3>📥 Solicitações Recebidas</h3>
          {recebidas.length === 0 ? (
            <p className="empty-state">Nenhuma solicitação pendente</p>
          ) : (
            <div className="trocas-lista">
              {recebidas.map(troca => (
                <div key={troca.id} id={`troca-${troca.id}`} className="troca-card">
                  <div className="troca-info">
                    <p>
                      <strong>{troca.solicitanteNome}</strong>{' '}
                      {troca.escalaSolicitadaId
                        ? <>quer trocar a escala dele(a) pela <strong>sua</strong> escala de {formatPeriodoSolicitada(troca)}</>
                        : <>quer trocar {ehUmDiaSo(troca) ? 'o dia' : 'o período'} com você</>}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && 'Oferece em troca: '}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                    <ItensExtras troca={troca} />
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

      {podeVerPropriaTroca && (
        <div className="trocas-secao">
          <h3>🗂️ Histórico de Solicitações Recebidas</h3>
          {recebidasHistorico.length === 0 ? (
            <p className="empty-state">Nenhuma solicitação respondida ainda</p>
          ) : (
            <div className="trocas-lista">
              {recebidasHistorico.map(troca => (
                <div key={troca.id} id={`troca-${troca.id}`} className="troca-card">
                  <div className="troca-info">
                    <p>
                      {troca.direta ? (
                        <>Um admin/gestor colocou você no lugar de <strong>{troca.solicitanteNome}</strong> nessa escala</>
                      ) : (
                        <>
                          <strong>{troca.solicitanteNome}</strong>{' '}
                          {troca.escalaSolicitadaId
                            ? <>pediu para trocar a escala dele(a) pela <strong>sua</strong> escala de {formatPeriodoSolicitada(troca)}</>
                            : <>pediu para trocar {ehUmDiaSo(troca) ? 'o dia' : 'o período'} com você</>}
                        </>
                      )}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && 'Ofereceu em troca: '}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                    <ItensExtras troca={troca} />
                  </div>
                  <span className={`status-badge troca-status-${troca.status}`}>{STATUS_LABEL[troca.status] || troca.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {podeVerPropriaTroca && (
        <div className="trocas-secao">
          <h3>📤 Minhas Solicitações</h3>
          {minhas.length === 0 ? (
            <p className="empty-state">Você ainda não solicitou nenhuma troca</p>
          ) : (
            <div className="trocas-lista">
              {minhas.map(troca => (
                <div key={troca.id} id={`troca-${troca.id}`} className="troca-card">
                  <div className="troca-info">
                    <p>
                      {troca.direta ? (
                        <>Um admin/gestor trocou você por <strong>{troca.destinoNome}</strong> nessa escala</>
                      ) : (
                        <>{troca.escalaSolicitadaId ? 'Proposta de troca' : 'Troca'} com <strong>{troca.destinoNome}</strong></>
                      )}
                      {!troca.escalaSolicitadaId && <> · {ehUmDiaSo(troca) ? 'o dia' : 'o período'}</>}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && 'Você oferece: '}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                    {troca.escalaSolicitadaId && (
                      <p className="troca-detalhe">Você pede: {formatPeriodoSolicitada(troca)}</p>
                    )}
                    <ItensExtras troca={troca} />
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

      {podeVerVisaoGeral && (
        <div className="trocas-secao">
          <h3>📋 {(userData?.role === 'gestor' || userData?.role === 'lider') ? 'Trocas da Equipe' : 'Todas as Trocas'}</h3>
          {visaoGeral.length === 0 ? (
            <p className="empty-state">Nenhuma troca registrada</p>
          ) : (
            <div className="trocas-lista">
              {visaoGeral.map(troca => (
                <div key={troca.id} id={`troca-${troca.id}`} className="troca-card">
                  <div className="troca-info">
                    <p>
                      <strong>{troca.solicitanteNome}</strong> → <strong>{troca.destinoNome}</strong>
                      {!troca.escalaSolicitadaId && <> · {ehUmDiaSo(troca) ? 'um dia' : 'período'}</>}
                      {troca.escalaSolicitadaId && ' · troca mútua'}
                      {troca.direta && <> · <span className="troca-badge-direta">🔄 troca direta</span></>}
                    </p>
                    <p className="troca-detalhe">
                      {troca.escalaSolicitadaId && `${troca.solicitanteNome} oferece: `}
                      {TIPOS_ESCALA[troca.escalaTipo] || troca.escalaTipo} · {formatPeriodo(troca)} · {troca.equipe?.toUpperCase()}
                    </p>
                    {troca.escalaSolicitadaId && (
                      <p className="troca-detalhe">{troca.solicitanteNome} pede: {formatPeriodoSolicitada(troca)}</p>
                    )}
                    <ItensExtras troca={troca} />
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
