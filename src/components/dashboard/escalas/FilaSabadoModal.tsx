'use client'

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { useNotificacao } from '../../../context/NotificacaoContext'
import { mensagemDeErro } from '../../../lib/erros'
import { ehJovemAprendiz } from '../../../lib/escalasConstants'
import type { Usuario } from '../../../types/dominio'

// Quem pode entrar na fila de Sábado — mesma regra que o gerador aplica na
// hora de montar a escala (Analista, Analista G. e Estag/Aprendiz/Trainee
// nunca participam, e é só da equipe Suporte).
function elegivelParaSabado(u: Usuario): boolean {
  return u.equipe === 'suporte' && u.ativo &&
    u.role !== 'admin' && u.role !== 'gestor' && u.role !== 'analista' && u.role !== 'lider' &&
    !ehJovemAprendiz(u.role)
}

const REMOVER = '__remover__'

export default function FilaSabadoModal({ usuarios, onClose }: {
  usuarios: Usuario[]
  onClose: () => void
}) {
  const { notificar } = useNotificacao()
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ordem, setOrdem] = useState<string[]>([])
  // Substituições feitas nessa edição (deUid saiu, paraUid entrou no lugar
  // dele) — vão junto no salvar, pra também transferir os sábados que
  // deUid já tinha agendados de hoje em diante.
  const [substituicoes, setSubstituicoes] = useState<Array<{ deUid: string; paraUid: string }>>([])

  const elegiveis = usuarios.filter(elegivelParaSabado)
  const nomePorUid = (uid: string) => elegiveis.find(u => u.uid === uid)?.nome || 'Desconhecido'

  useEffect(() => {
    const carregar = async () => {
      try {
        const res = await fetch('/api/fila-sabado')
        const data = await res.json().catch(() => ({}))
        const salvos: string[] = Array.isArray(data.uids) ? data.uids : []
        // Só entra quem está de fato salvo na fila — quem não é mais
        // elegível (saiu da equipe, virou aprendiz etc.) some sozinho, mas
        // quem foi removido de propósito NUNCA volta sozinho: entrar na
        // fila (gente nova, ou alguém que saiu e agora voltou) é sempre uma
        // ação explícita sua, no "➕ Adicionar" no final da lista.
        const elegiveisUids = new Set(elegiveis.map(u => u.uid))
        setOrdem(salvos.filter(uid => elegiveisUids.has(uid)))
      } catch (error) {
        console.error('Erro ao carregar fila de sábado:', error)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Animação de reordenar (técnica FLIP: guarda a posição de cada linha
  // ANTES de mudar a ordem, deixa o React re-renderizar, e depois desliza
  // de onde estava pra onde ficou — sem isso as linhas só "pulavam"
  // direto pro lugar novo, sem transição nenhuma).
  const refsPorUid = useRef<Record<string, HTMLDivElement | null>>({})
  const posicoesAntesRef = useRef<Record<string, number> | null>(null)

  const capturarPosicoes = () => {
    const posicoes: Record<string, number> = {}
    for (const uid of ordem) {
      const el = refsPorUid.current[uid]
      if (el) posicoes[uid] = el.getBoundingClientRect().top
    }
    posicoesAntesRef.current = posicoes
  }

  useLayoutEffect(() => {
    const antes = posicoesAntesRef.current
    if (!antes) return
    posicoesAntesRef.current = null
    for (const uid of ordem) {
      const el = refsPorUid.current[uid]
      if (!el) continue
      const posicaoAntes = antes[uid]
      if (posicaoAntes === undefined) continue
      const posicaoDepois = el.getBoundingClientRect().top
      const delta = posicaoAntes - posicaoDepois
      if (delta === 0) continue
      el.style.transition = 'none'
      el.style.transform = `translateY(${delta}px)`
      el.getBoundingClientRect() // força o navegador a aplicar antes de animar
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.25s ease'
        el.style.transform = ''
      })
    }
  }, [ordem])

  const mover = (indice: number, delta: number) => {
    capturarPosicoes()
    setOrdem(atual => {
      const novoIndice = indice + delta
      if (novoIndice < 0 || novoIndice >= atual.length) return atual
      const copia = [...atual]
      ;[copia[indice], copia[novoIndice]] = [copia[novoIndice], copia[indice]]
      return copia
    })
  }

  // Arrastar e soltar (além das setas): segura na alcinha, arrasta, e uma
  // barra horizontal mostra ENTRE quais dois nomes vai cair, soltando no
  // gap certo. Usa Pointer Events com setPointerCapture no próprio
  // elemento que iniciou o arraste — assim os eventos de mover/soltar
  // continuam chegando nele mesmo quando o dedo/mouse sai por cima de
  // outra linha, sem precisar de listener global pra limpar depois.
  const [arrastandoIndice, setArrastandoIndice] = useState<number | null>(null)
  const [gapDestino, setGapDestino] = useState<number | null>(null)

  const calcularGap = (clientY: number): number => {
    for (let idx = 0; idx < ordem.length; idx++) {
      const el = refsPorUid.current[ordem[idx]]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return idx
    }
    return ordem.length
  }

  const iniciarArrasto = (e: PointerEvent<HTMLSpanElement>, indice: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setArrastandoIndice(indice)
    setGapDestino(indice)
  }

  const moverArrasto = (e: PointerEvent<HTMLSpanElement>) => {
    if (arrastandoIndice === null) return
    setGapDestino(calcularGap(e.clientY))
  }

  const soltarArrasto = () => {
    if (arrastandoIndice !== null && gapDestino !== null && gapDestino !== arrastandoIndice && gapDestino !== arrastandoIndice + 1) {
      capturarPosicoes()
      setOrdem(atual => {
        const copia = [...atual]
        const [item] = copia.splice(arrastandoIndice, 1)
        const indiceInsercao = arrastandoIndice < gapDestino ? gapDestino - 1 : gapDestino
        copia.splice(indiceInsercao, 0, item)
        return copia
      })
    }
    setArrastandoIndice(null)
    setGapDestino(null)
  }

  // Troca quem ocupa essa posição da fila (ex: pessoa foi demitida ou saiu
  // do rodízio) — mantém o LUGAR na fila, só muda quem está nele, em vez
  // de remover e a pessoa nova entrar sempre no final. Também registra a
  // troca pra, ao salvar, transferir pro substituto os sábados que a
  // pessoa anterior já tinha agendados de hoje em diante — sem isso, a
  // fila mudaria pro futuro mas os sábados já gerados ficariam com quem
  // saiu. "Remover esse lugar" tira a posição de vez, sem substituir por
  // ninguém (não transfere nada — os sábados já agendados ficam como
  // estão, pra tratar na mão se for o caso).
  const substituir = (indice: number, valor: string) => {
    const deUid = ordem[indice]
    capturarPosicoes()
    setOrdem(atual => {
      if (valor === REMOVER) return atual.filter((_, i) => i !== indice)
      const copia = [...atual]
      copia[indice] = valor
      return copia
    })
    if (valor !== REMOVER) {
      setSubstituicoes(atual => [...atual, { deUid, paraUid: valor }])
    }
  }

  // Entrar na fila (gente nova contratada, ou alguém que foi removido e
  // agora deve voltar) é sempre por aqui — nunca sozinho.
  const adicionar = (uid: string) => {
    if (!uid) return
    capturarPosicoes()
    setOrdem(atual => [...atual, uid])
  }

  const disponiveisParaAdicionar = elegiveis
    .filter(u => !ordem.includes(u.uid))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const salvar = async () => {
    setSalvando(true)
    try {
      const res = await fetch('/api/fila-sabado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: ordem, substituicoes }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar a fila')
      }
      notificar(
        substituicoes.length > 0
          ? 'Fila de Sábado salva! Os sábados já agendados de quem foi substituído também passaram pra quem entrou no lugar.'
          : 'Fila de Sábado salva! O rodízio vai seguir essa ordem a partir da próxima geração.',
        { tipo: 'sucesso' }
      )
      onClose()
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📅 Fila de Sábado</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">
            Defina a ordem do rodízio de Escala Sábado — o gerador segue essa fila em vez da ordem alfabética. Ao substituir alguém, quem entra no lugar assume também os sábados que ela já tinha agendados de hoje em diante (sábados que já passaram não mudam). Remover (sem substituir) é definitivo: quem sai não volta sozinho, só se você adicionar de novo ali embaixo — e os sábados que já tinha ficam como estão, pra você trocar na mão se precisar.
          </p>

          {carregando ? (
            <p>Carregando...</p>
          ) : elegiveis.length === 0 ? (
            <p className="campo-nota">Nenhum técnico elegível pra Escala Sábado na equipe Suporte.</p>
          ) : (
            <>
              {ordem.length === 0 ? (
                <p className="campo-nota">A fila está vazia — adicione alguém abaixo.</p>
              ) : (
                <div className="fila-sabado-lista">
                  {ordem.map((uid, i) => {
                    const disponiveisParaSubstituir = elegiveis.filter(u => u.uid === uid || !ordem.includes(u.uid))
                    return (
                      <div key={uid}>
                        {gapDestino === i && arrastandoIndice !== null && (
                          <div className="fila-sabado-indicador" />
                        )}
                        <div
                          ref={(el) => { refsPorUid.current[uid] = el }}
                          className={`fila-sabado-item${arrastandoIndice === i ? ' fila-sabado-item-arrastando' : ''}`}
                        >
                          <span
                            className="fila-sabado-grip"
                            title="Arrastar pra reordenar"
                            onPointerDown={(e) => iniciarArrasto(e, i)}
                            onPointerMove={moverArrasto}
                            onPointerUp={soltarArrasto}
                            onPointerCancel={soltarArrasto}
                          >
                            <span /><span /><span /><span /><span /><span />
                          </span>
                          <span className="fila-sabado-posicao">{i + 1}º</span>
                          <select
                            className="fila-sabado-nome fila-sabado-nome-select"
                            value={uid}
                            onChange={(e) => substituir(i, e.target.value)}
                            title="Trocar quem ocupa esse lugar"
                          >
                            <option value={uid}>{nomePorUid(uid)}</option>
                            {disponiveisParaSubstituir.filter(u => u.uid !== uid).map(u => (
                              <option key={u.uid} value={u.uid}>🔄 {u.nome}</option>
                            ))}
                            <option value={REMOVER}>➖ Remover esse lugar</option>
                          </select>
                          <div className="fila-sabado-acoes">
                            <button type="button" className="btn-secondary" disabled={i === 0} onClick={() => mover(i, -1)} title="Subir">
                              ↑
                            </button>
                            <button type="button" className="btn-secondary" disabled={i === ordem.length - 1} onClick={() => mover(i, 1)} title="Descer">
                              ↓
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {gapDestino === ordem.length && arrastandoIndice !== null && (
                    <div className="fila-sabado-indicador" />
                  )}
                </div>
              )}

              {disponiveisParaAdicionar.length > 0 && (
                <select
                  className="fila-sabado-adicionar"
                  value=""
                  onChange={(e) => adicionar(e.target.value)}
                >
                  <option value="">➕ Adicionar técnico à fila...</option>
                  {disponiveisParaAdicionar.map(u => (
                    <option key={u.uid} value={u.uid}>{u.nome}</option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        <div className="form-actions-modal">
          {!carregando && elegiveis.length > 0 && (
            <button type="button" className="btn-success" disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando...' : '💾 Salvar fila'}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
