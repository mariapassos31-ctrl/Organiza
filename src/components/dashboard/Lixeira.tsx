'use client'

import { useState, useEffect } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import { useNotificacao } from '../../context/NotificacaoContext'
import { mensagemDeErro } from '../../lib/erros'
import type { EscalaLixeira } from '../../types/dominio'
import '../../styles/Lixeira.css'

const TIPOS_ESCALA: Record<string, string> = {
  presencial: '🏢 Presencial',
  homeoffice: '🏠 Home Office',
  sabado: '📅 Escala Sábado',
  sobreaviso: '🚨 Sobreaviso',
}

export default function Lixeira() {
  const { userData } = useDashboardUser()
  const { notificar, confirmar } = useNotificacao()
  const [itens, setItens] = useState<EscalaLixeira[]>([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [processandoLote, setProcessandoLote] = useState(false)
  const [selecionadas, setSelecionadas] = useState<string[]>([])

  const carregar = async () => {
    try {
      const res = await fetch('/api/escalas/lixeira')
      const data = await res.json()
      setItens(Array.isArray(data) ? data : [])
      setSelecionadas([])
    } catch (error) {
      console.error('Erro ao carregar lixeira:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userData) return
    carregar()
  }, [userData])

  const alternarSelecao = (id: string) => {
    setSelecionadas(atual => atual.includes(id) ? atual.filter(i => i !== id) : [...atual, id])
  }

  const alternarSelecionarTodas = () => {
    setSelecionadas(atual => atual.length === itens.length ? [] : itens.map(i => i.id))
  }

  const restaurar = async (id: string) => {
    setProcessando(id)
    try {
      const res = await fetch(`/api/escalas/lixeira/${encodeURIComponent(id)}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao restaurar a escala')
      }
      notificar('Escala restaurada!', { tipo: 'sucesso' })
      await carregar()
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setProcessando(null)
    }
  }

  const apagarDefinitivo = async (id: string) => {
    const confirmou = await confirmar(
      'Apagar essa escala definitivamente? Depois disso não tem mais como recuperar.',
      { titulo: 'Apagar definitivamente', textoConfirmar: 'Apagar' }
    )
    if (!confirmou) return
    setProcessando(id)
    try {
      const res = await fetch(`/api/escalas/lixeira/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao apagar a escala')
      }
      notificar('Escala apagada definitivamente.', { tipo: 'sucesso' })
      await carregar()
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setProcessando(null)
    }
  }

  const apagarSelecionadas = async () => {
    if (selecionadas.length === 0) return
    const confirmou = await confirmar(
      `Apagar ${selecionadas.length} escala(s) definitivamente? Depois disso não tem mais como recuperar.`,
      { titulo: 'Apagar definitivamente', textoConfirmar: 'Apagar' }
    )
    if (!confirmou) return
    setProcessandoLote(true)
    try {
      const res = await fetch('/api/escalas/lixeira/excluir-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selecionadas }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao apagar as escalas selecionadas')
      }
      notificar(
        data.falhas > 0
          ? `${data.apagadas} escala(s) apagada(s). ${data.falhas} não puderam ser apagadas.`
          : `${data.apagadas} escala(s) apagada(s) definitivamente.`,
        { tipo: data.falhas > 0 ? 'erro' : 'sucesso' }
      )
      await carregar()
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setProcessandoLote(false)
    }
  }

  if (loading) {
    return <div className="lixeira-container"><p>Carregando...</p></div>
  }

  return (
    <div className="lixeira-container">
      <div className="lixeira-header">
        <h2>🗑️ Lixeira de Escalas</h2>
        <p className="subtitle">
          Escalas apagadas ficam aqui por 7 dias antes de sumirem de vez — dá pra restaurar ou apagar definitivamente antes disso.
        </p>
      </div>

      {itens.length === 0 ? (
        <p className="empty-state">A lixeira está vazia</p>
      ) : (
        <>
          <div className="lixeira-barra-lote">
            <label className="lixeira-selecionar-todas">
              <input
                type="checkbox"
                checked={selecionadas.length === itens.length}
                onChange={alternarSelecionarTodas}
              />
              Selecionar todas
            </label>
            {selecionadas.length > 0 && (
              <button className="btn-delete" disabled={processandoLote} onClick={apagarSelecionadas}>
                {processandoLote ? 'Apagando...' : `🗑️ Apagar ${selecionadas.length} selecionada(s)`}
              </button>
            )}
          </div>

          <div className="lixeira-lista">
            {itens.map(item => (
              <div key={item.id} className="lixeira-card">
                <input
                  type="checkbox"
                  className="lixeira-checkbox"
                  checked={selecionadas.includes(item.id)}
                  onChange={() => alternarSelecao(item.id)}
                />
                <div className="lixeira-info">
                  <p>
                    <strong>{TIPOS_ESCALA[item.tipo] || item.tipo}</strong>
                    {item.equipe && <> · {item.equipe.toUpperCase()}</>}
                    {' · '}
                    {new Date(item.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {item.dataInicio !== item.dataFim && (
                      <> a {new Date(item.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</>
                    )}
                  </p>
                  <p className="lixeira-detalhe">
                    {item.tecnicosNomes.length > 0 ? item.tecnicosNomes.join(', ') : 'Sem técnico'}
                  </p>
                  <p className="lixeira-detalhe">
                    Apagada em {new Date(item.dataExclusao).toLocaleDateString('pt-BR')}
                    {' · '}
                    <span className={item.diasRestantes <= 2 ? 'lixeira-prazo-urgente' : ''}>
                      {item.diasRestantes > 0
                        ? `some em ${item.diasRestantes} dia${item.diasRestantes === 1 ? '' : 's'}`
                        : 'será removida em breve'}
                    </span>
                  </p>
                </div>
                <div className="lixeira-actions">
                  <button className="btn-success" disabled={processando === item.id} onClick={() => restaurar(item.id)}>
                    ♻️ Restaurar
                  </button>
                  <button className="btn-delete" disabled={processando === item.id} onClick={() => apagarDefinitivo(item.id)}>
                    🗑️ Apagar definitivo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
