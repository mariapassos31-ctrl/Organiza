'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import '../styles/Notificacao.css'

type TipoNotificacao = 'sucesso' | 'erro' | 'info'

interface ItemFila {
  id: number
  modo: 'aviso' | 'confirmacao'
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  textoConfirmar?: string
  resolve?: (valor: boolean) => void
}

interface NotificacaoValue {
  // Substitui window.alert(mensagem) — só fecha, sem escolha.
  notificar: (mensagem: string, opcoes?: { tipo?: TipoNotificacao; titulo?: string }) => void
  // Substitui window.confirm(mensagem) — devolve true/false conforme o
  // clique; precisa de "await" no lugar de chamar.
  confirmar: (mensagem: string, opcoes?: { titulo?: string; textoConfirmar?: string }) => Promise<boolean>
}

const NotificacaoContext = createContext<NotificacaoValue | null>(null)

const TITULO_PADRAO: Record<TipoNotificacao, string> = {
  sucesso: '✅ Sucesso',
  erro: '❌ Erro',
  info: 'ℹ️ Aviso',
}

let proximoId = 0

export function NotificacaoProvider({ children }: { children: ReactNode }) {
  const [fila, setFila] = useState<ItemFila[]>([])

  const notificar = useCallback((mensagem: string, opcoes?: { tipo?: TipoNotificacao; titulo?: string }) => {
    const tipo = opcoes?.tipo ?? 'info'
    setFila(atual => [...atual, {
      id: ++proximoId,
      modo: 'aviso',
      tipo,
      titulo: opcoes?.titulo ?? TITULO_PADRAO[tipo],
      mensagem,
    }])
  }, [])

  const confirmar = useCallback((mensagem: string, opcoes?: { titulo?: string; textoConfirmar?: string }) => {
    return new Promise<boolean>((resolve) => {
      setFila(atual => [...atual, {
        id: ++proximoId,
        modo: 'confirmacao',
        tipo: 'info',
        titulo: opcoes?.titulo ?? 'Confirmar',
        mensagem,
        textoConfirmar: opcoes?.textoConfirmar ?? 'Confirmar',
        resolve,
      }])
    })
  }, [])

  const item = fila[0]

  const fechar = (valor: boolean) => {
    item?.resolve?.(valor)
    setFila(atual => atual.slice(1))
  }

  return (
    <NotificacaoContext.Provider value={{ notificar, confirmar }}>
      {children}
      {item && (
        <div
          className="modal-overlay notificacao-overlay"
          onClick={() => item.modo === 'aviso' && fechar(true)}
        >
          <div
            className={`modal-content notificacao-modal notificacao-modal-${item.tipo}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{item.titulo}</h3>
              {item.modo === 'aviso' && (
                <button className="modal-close" onClick={() => fechar(true)}>✕</button>
              )}
            </div>
            <div className="notificacao-corpo">
              {item.mensagem.split('\n').map((linha, i) => linha ? <p key={i}>{linha}</p> : <br key={i} />)}
            </div>
            <div className="form-actions-modal">
              {item.modo === 'confirmacao' ? (
                <>
                  <button className="btn-success" onClick={() => fechar(true)}>{item.textoConfirmar}</button>
                  <button className="btn-secondary" onClick={() => fechar(false)}>Cancelar</button>
                </>
              ) : (
                <button className="btn-success" onClick={() => fechar(true)}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </NotificacaoContext.Provider>
  )
}

export function useNotificacao(): NotificacaoValue {
  const ctx = useContext(NotificacaoContext)
  if (!ctx) {
    throw new Error('useNotificacao precisa ser usado dentro de um NotificacaoProvider')
  }
  return ctx
}
