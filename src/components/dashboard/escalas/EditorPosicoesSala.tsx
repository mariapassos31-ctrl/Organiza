'use client'

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { POSICOES_BAIA } from './MapaBaias'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'
import type { MarcadorSala, PosicaoBaia, Sala, TipoMarcador } from '../../../types/dominio'

interface EditorPosicoesSalaProps {
  sala: Sala
  // Outras salas já cadastradas — usado só pra achar uma que reaproveite a
  // mesma foto (ex: o mesmo layout gerado por IA, subido em mais de uma
  // sala) e copiar as posições já calibradas dela, em vez de chutar.
  todasAsSalas?: Sala[]
  onSalvarPosicoes: (posicoes: Record<string, PosicaoBaia>) => Promise<boolean> | boolean
  onSalvarMarcadores: (marcadores: MarcadorSala[]) => Promise<boolean> | boolean
  onClose: () => void
}

export const TIPOS_MARCADOR: { id: TipoMarcador; emoji: string; label: string }[] = [
  { id: 'divisoria', emoji: '📦', label: 'Divisória' },
  { id: 'rack', emoji: '🗄️', label: 'Rack' },
  { id: 'impressora', emoji: '🖨️', label: 'Impressora' },
  { id: 'outro', emoji: '🏷️', label: 'Outro' },
]

const ROTULO_PADRAO: Record<TipoMarcador, string> = {
  divisoria: 'Divisória',
  rack: 'Rack',
  impressora: 'Impressora',
  outro: 'Item',
}

export function emojiDoMarcador(tipo: TipoMarcador): string {
  return TIPOS_MARCADOR.find(t => t.id === tipo)?.emoji || '🏷️'
}

interface Soquete { id: string; top: string; left: string }

type Selecionado = { tipo: 'soquete'; id: string } | { tipo: 'marcador'; id: string } | null

type Arrastando =
  | { tipo: 'soquete'; id: string } // reposiciona o soquete vazio, ao vivo, seguindo o mouse
  | { tipo: 'marcador'; id: string } // reposiciona o item de referência, ao vivo
  | { tipo: 'numero'; numero: string; origemSoqueteId: string | null; x: number; y: number } // só decide onde encaixa ao soltar
  | null

// Grade "imaginária" (só usada no cálculo, não aparece desenhada) — toda
// posição de soquete já cola no múltiplo de 5% mais próximo, tipo um ímã.
const PASSO_GRADE = 5
function colarNaGrade(percentual: number): number {
  const limitado = Math.max(0, Math.min(100, percentual))
  return Math.round(limitado / PASSO_GRADE) * PASSO_GRADE
}

// Só reconhece o encaixe se o número for solto perto o suficiente de um
// soquete (em % da imagem) — senão o número volta pra bandeja.
const LIMIAR_ENCAIXE = 9

function idAleatorio(prefixo: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefixo}-${crypto.randomUUID()}`
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Espalha `total` itens num intervalo de 15% a 85%, pra nenhum ficar
// colado na borda da imagem.
function espalhar(indice: number, total: number): number {
  if (total <= 1) return 50
  return Math.round(15 + indice * (70 / (total - 1)))
}

// Só reaproveita o layout da planta original do Suporte (POSICOES_BAIA)
// quando a foto da sala É de fato aquela imagem fixa — outras salas têm
// fotos diferentes, com as caixas das baias em lugares diferentes, então
// aplicar essas coordenadas nelas ficaria torto.
function posicoesConhecidasDaFoto(sala: Sala): Record<string, PosicaoBaia> | null {
  if (sala.imagem === IMAGEM_COM_POSICOES_CONHECIDAS) return POSICOES_BAIA
  return null
}

// Quando a mesma foto (mesmo hash dos bytes da imagem) já foi usada em
// outra sala que já teve as posições calibradas nela, reaproveita — é o
// caso comum de uma planta gerada uma vez e subida em mais de uma sala.
function posicoesCopiadasDeOutraSala(sala: Sala, todasAsSalas: Sala[]): Record<string, PosicaoBaia> | null {
  if (!sala.imagemHash) return null
  const outra = todasAsSalas.find(o => o.id !== sala.id && o.imagemHash === sala.imagemHash && Object.keys(o.posicoes || {}).length > 0)
  return outra?.posicoes || null
}

// Chute de última instância, só quando não dá pra saber de verdade onde
// fica cada baia na foto (planta nunca vista antes) — espalha numa grade.
// Não é perfeito, mas já dá um ponto de partida melhor que nada, só
// arrastar pra ajustar depois.
function posicaoEmGrade(indice: number, total: number): PosicaoBaia {
  const colunas = Math.max(1, Math.ceil(Math.sqrt(total)))
  const linhas = Math.max(1, Math.ceil(total / colunas))
  const coluna = indice % colunas
  const linha = Math.floor(indice / colunas)
  return { top: `${espalhar(linha, linhas)}%`, left: `${espalhar(coluna, colunas)}%` }
}

// Já cria um soquete (com o número certo já encaixado) pra cada baia, na
// posição certa sempre que dá pra saber — a que já foi salva antes, a da
// planta fixa do Suporte (se for a foto dela) ou a de outra sala que
// reaproveitou a mesma foto e já foi calibrada. Só cai na grade genérica
// quando nada disso serve. Assim ninguém precisa clicar pra criar nada.
function soquetesIniciaisDe(numeros: string[], sala: Sala, todasAsSalas: Sala[]): { soquetes: Soquete[]; atribuicoes: Record<string, string> } {
  const posicoesExistentes = sala.posicoes || {}
  const conhecidas = posicoesConhecidasDaFoto(sala)
  const copiadas = posicoesCopiadasDeOutraSala(sala, todasAsSalas)
  const soquetes: Soquete[] = []
  const atribuicoes: Record<string, string> = {}
  numeros.forEach((numero, indice) => {
    const pos = posicoesExistentes[numero] || conhecidas?.[numero] || copiadas?.[numero] || posicaoEmGrade(indice, numeros.length)
    const id = idAleatorio('sk')
    soquetes.push({ id, top: pos.top, left: pos.left })
    atribuicoes[id] = numero
  })
  return { soquetes, atribuicoes }
}

// Passo 1: clicar na planta em cima de cada caixinha vazia da foto cria um
// "soquete" fixo ali (retângulo pontilhado, parado, sem número nenhum).
// Passo 2: arrastar o número 1, 2, 3... pra cima de um desses soquetes —
// ele reconhece e encaixa ali sozinho (tipo um ímã), substituindo quem
// estivesse lá antes (ou trocando de lugar, se o número já tinha um
// soquete). Isso vale só pras baias; os itens de referência (divisória,
// rack...) continuam com arraste livre, sem soquete.
export default function EditorPosicoesSala({ sala, todasAsSalas = [], onSalvarPosicoes, onSalvarMarcadores, onClose }: EditorPosicoesSalaProps) {
  const numeros = Array.from({ length: sala.qtdBaias || 9 }, (_, i) => String(i + 1))
  const [{ soquetes: soquetesIniciais, atribuicoes: atribuicoesIniciais }] = useState(() => soquetesIniciaisDe(numeros, sala, todasAsSalas))
  const [soquetes, setSoquetes] = useState<Soquete[]>(soquetesIniciais)
  const [atribuicoes, setAtribuicoes] = useState<Record<string, string>>(atribuicoesIniciais)
  const [marcadores, setMarcadores] = useState<MarcadorSala[]>(sala.marcadores || [])
  const [selecionado, setSelecionado] = useState<Selecionado>(null)
  const [arrastando, setArrastando] = useState<Arrastando>(null)
  const [salvando, setSalvando] = useState(false)
  const [semAlteracao, setSemAlteracao] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const plantaRef = useRef<HTMLDivElement>(null)

  const numeroDoSoquete = (id: string) => atribuicoes[id]
  const soqueteDoNumero = (numero: string) => Object.keys(atribuicoes).find(id => atribuicoes[id] === numero) || null
  const numerosNaBandeja = numeros.filter(n => !soqueteDoNumero(n))

  const posicoesFinais: Record<string, PosicaoBaia> = {}
  for (const s of soquetes) {
    const numero = atribuicoes[s.id]
    if (numero) posicoesFinais[numero] = { top: s.top, left: s.left }
  }
  const alteradoPosicoes = JSON.stringify(posicoesFinais) !== JSON.stringify(sala.posicoes || {})
  const alteradoMarcadores = JSON.stringify(marcadores) !== JSON.stringify(sala.marcadores || [])
  const alterado = alteradoPosicoes || alteradoMarcadores

  // Decide, ao soltar um número, em qual soquete ele encaixou — o mais
  // próximo dentro do limite; se não tiver nenhum perto o bastante, o
  // número simplesmente volta pra bandeja (ou fica onde já estava).
  const soltarNumero = (numero: string, origemSoqueteId: string | null, clientX: number, clientY: number) => {
    const rect = plantaRef.current?.getBoundingClientRect()
    if (!rect) return
    const leftPct = ((clientX - rect.left) / rect.width) * 100
    const topPct = ((clientY - rect.top) / rect.height) * 100

    let alvoId: string | null = null
    let menorDistancia = LIMIAR_ENCAIXE
    for (const s of soquetes) {
      const distancia = Math.hypot(parseFloat(s.left) - leftPct, parseFloat(s.top) - topPct)
      if (distancia < menorDistancia) {
        menorDistancia = distancia
        alvoId = s.id
      }
    }

    setAtribuicoes(prev => {
      const proximo = { ...prev }
      if (origemSoqueteId) delete proximo[origemSoqueteId]
      if (alvoId) {
        const numeroQueJaEstavaLa = prev[alvoId]
        if (numeroQueJaEstavaLa && numeroQueJaEstavaLa !== numero && origemSoqueteId) {
          proximo[origemSoqueteId] = numeroQueJaEstavaLa // troca de lugar
        }
        proximo[alvoId] = numero
      }
      return proximo
    })
  }

  useEffect(() => {
    if (!arrastando) return
    const mover = (e: globalThis.MouseEvent) => {
      if (arrastando.tipo === 'numero') {
        setArrastando(atual => (atual?.tipo === 'numero' ? { ...atual, x: e.clientX, y: e.clientY } : atual))
        return
      }
      const rect = plantaRef.current?.getBoundingClientRect()
      if (!rect) return
      const left = colarNaGrade(((e.clientX - rect.left) / rect.width) * 100) + '%'
      const top = colarNaGrade(((e.clientY - rect.top) / rect.height) * 100) + '%'
      if (arrastando.tipo === 'soquete') {
        setSoquetes(prev => prev.map(s => s.id === arrastando.id ? { ...s, top, left } : s))
      } else {
        setMarcadores(prev => prev.map(m => m.id === arrastando.id ? { ...m, top, left } : m))
      }
    }
    const soltar = (e: globalThis.MouseEvent) => {
      if (arrastando.tipo === 'numero') {
        soltarNumero(arrastando.numero, arrastando.origemSoqueteId, e.clientX, e.clientY)
      }
      setArrastando(null)
    }
    window.addEventListener('mousemove', mover)
    window.addEventListener('mouseup', soltar)
    return () => {
      window.removeEventListener('mousemove', mover)
      window.removeEventListener('mouseup', soltar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastando, soquetes])

  const pararPropagacao = (e: { stopPropagation: () => void }) => e.stopPropagation()

  const criarSoquete = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const left = colarNaGrade(((e.clientX - rect.left) / rect.width) * 100) + '%'
    const top = colarNaGrade(((e.clientY - rect.top) / rect.height) * 100) + '%'
    const novo: Soquete = { id: idAleatorio('sk'), top, left }
    setSoquetes(prev => [...prev, novo])
    setSelecionado({ tipo: 'soquete', id: novo.id })
  }

  const mouseDownNoSoquete = (e: ReactMouseEvent, soquete: Soquete) => {
    e.stopPropagation()
    setSelecionado({ tipo: 'soquete', id: soquete.id })
    const numero = numeroDoSoquete(soquete.id)
    if (numero) {
      setArrastando({ tipo: 'numero', numero, origemSoqueteId: soquete.id, x: e.clientX, y: e.clientY })
    } else {
      setArrastando({ tipo: 'soquete', id: soquete.id })
    }
  }

  const mouseDownNaBandeja = (e: ReactMouseEvent, numero: string) => {
    e.preventDefault()
    setArrastando({ tipo: 'numero', numero, origemSoqueteId: null, x: e.clientX, y: e.clientY })
  }

  const removerSoqueteSelecionado = () => {
    if (selecionado?.tipo !== 'soquete') return
    const id = selecionado.id
    setSoquetes(prev => prev.filter(s => s.id !== id))
    setAtribuicoes(prev => {
      const proximo = { ...prev }
      delete proximo[id]
      return proximo
    })
    setSelecionado(null)
  }

  const adicionarMarcador = (tipoMarcador: TipoMarcador) => {
    const novo: MarcadorSala = {
      id: idAleatorio('mk'),
      tipo: tipoMarcador,
      rotulo: ROTULO_PADRAO[tipoMarcador],
      top: '50%',
      left: '50%',
    }
    setMarcadores(prev => [...prev, novo])
    setSelecionado({ tipo: 'marcador', id: novo.id })
  }

  const marcadorSelecionado = selecionado?.tipo === 'marcador' ? marcadores.find(m => m.id === selecionado.id) : undefined

  const removerMarcadorSelecionado = () => {
    if (!marcadorSelecionado) return
    setMarcadores(prev => prev.filter(m => m.id !== marcadorSelecionado.id))
    setSelecionado(null)
  }

  const renomearMarcadorSelecionado = (rotulo: string) => {
    if (!marcadorSelecionado) return
    setMarcadores(prev => prev.map(m => m.id === marcadorSelecionado.id ? { ...m, rotulo } : m))
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      const okPosicoes = alteradoPosicoes ? await onSalvarPosicoes(posicoesFinais) : true
      const okMarcadores = alteradoMarcadores ? await onSalvarMarcadores(marcadores) : true
      if (okPosicoes && okMarcadores) onClose()
    } finally {
      setSalvando(false)
    }
  }

  const clicarSalvar = () => {
    if (!alterado) {
      setSemAlteracao(true)
      return
    }
    salvar()
  }

  const tentarFechar = () => {
    if (salvando) return
    if (alterado) {
      setConfirmandoSaida(true)
      return
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={tentarFechar}>
      <div className="modal-content modal-content-largo" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📍 Posições das baias — {sala.nome}</h3>
          <button className="modal-close" onClick={tentarFechar}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">
            Todo número já vem com um soquete e um palpite de posição — arraste cada um pro lugar certo em cima da planta.
            Se precisar de mais soquetes (ex: um layout bem diferente), clique num espaço vazio da planta e depois arraste o número certo pra dentro dele.
            <br />
            {soquetes.length} soquete(s), {numeros.length - numerosNaBandeja.length} de {numeros.length} números já encaixados.
          </p>

          <div className="mapa-baias-wrapper editor-posicoes-planta" ref={plantaRef} onClick={criarSoquete}>
            <img src={sala.imagem ?? undefined} alt={`Planta de ${sala.nome}`} className="mapa-baias-imagem" />
            {soquetes.map(s => {
              const numero = numeroDoSoquete(s.id)
              return (
                <div
                  key={s.id}
                  className={`editor-posicoes-marcador${selecionado?.tipo === 'soquete' && selecionado.id === s.id ? ' editor-posicoes-marcador-ativo' : ''}${!numero ? ' editor-posicoes-soquete-vazio' : ''}`}
                  style={{ top: s.top, left: s.left }}
                  onMouseDown={(e) => mouseDownNoSoquete(e, s)}
                  onClick={pararPropagacao}
                >
                  {numero || ''}
                </div>
              )
            })}
            {marcadores.map(m => (
              <div
                key={m.id}
                className={`editor-marcador-item${selecionado?.tipo === 'marcador' && selecionado.id === m.id ? ' editor-marcador-item-ativo' : ''}`}
                style={{ top: m.top, left: m.left }}
                onMouseDown={(e) => { e.stopPropagation(); setSelecionado({ tipo: 'marcador', id: m.id }); setArrastando({ tipo: 'marcador', id: m.id }) }}
                onClick={pararPropagacao}
              >
                <span className="editor-marcador-icone">{emojiDoMarcador(m.tipo)}</span>
                <span className="editor-marcador-rotulo">{m.rotulo}</span>
              </div>
            ))}
          </div>

          {selecionado?.tipo === 'soquete' && (
            <div className="editor-marcador-painel">
              <span className="campo-nota" style={{ margin: 0 }}>
                {numeroDoSoquete(selecionado.id) ? `Soquete com o número ${numeroDoSoquete(selecionado.id)}.` : 'Soquete vazio — arraste um número pra cá, ou arraste o soquete pra ajustar a posição.'}
              </span>
              <button type="button" className="btn-deletar" onClick={removerSoqueteSelecionado} disabled={salvando}>
                🗑️ Remover soquete
              </button>
            </div>
          )}

          <p className="config-baias-explicacao" style={{ marginTop: 16 }}>Números ainda não encaixados:</p>
          <div className="editor-posicoes-chips">
            {numerosNaBandeja.length === 0 && <span className="campo-nota">Todos os números já foram encaixados.</span>}
            {numerosNaBandeja.map(n => (
              <button
                key={n}
                type="button"
                className="editor-posicoes-chip"
                onMouseDown={(e) => mouseDownNaBandeja(e, n)}
                disabled={salvando}
              >
                {n}
              </button>
            ))}
          </div>

          <p className="config-baias-explicacao" style={{ marginTop: 16 }}>
            Além das baias, dá pra marcar outros pontos de referência na planta — divisória, rack, impressora ou um rótulo livre. Clique num tipo pra adicionar (aparece no meio da planta, aí é só arrastar). Não afeta reserva nenhuma.
          </p>
          <div className="editor-posicoes-chips">
            {TIPOS_MARCADOR.map(t => (
              <button
                key={t.id}
                type="button"
                className="editor-posicoes-chip"
                onClick={() => adicionarMarcador(t.id)}
                disabled={salvando}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          {marcadorSelecionado && (
            <div className="editor-marcador-painel">
              <input
                type="text"
                value={marcadorSelecionado.rotulo}
                maxLength={40}
                disabled={salvando}
                onChange={(e) => renomearMarcadorSelecionado(e.target.value)}
                placeholder="Rótulo desse item"
              />
              <button type="button" className="btn-deletar" onClick={removerMarcadorSelecionado} disabled={salvando}>
                🗑️ Remover item
              </button>
            </div>
          )}
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={tentarFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={clicarSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '💾 Salvar posições'}
          </button>
        </div>

        {semAlteracao && (
          <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Nenhuma alteração pra salvar</h4>
              <p>Você não mudou nada desde que abriu essa tela.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-primary" onClick={onClose}>OK</button>
              </div>
            </div>
          </div>
        )}

        {confirmandoSaida && (
          <div className="confirm-overlay" onClick={() => setConfirmandoSaida(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Sair sem salvar?</h4>
              <p>Você mudou posições ou itens da planta de "{sala.nome}" que ainda não foram salvos. Se sair agora, essas mudanças serão perdidas.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-secondary" onClick={() => setConfirmandoSaida(false)}>
                  Continuar editando
                </button>
                <button type="button" className="btn-deletar" onClick={onClose}>
                  Sair sem salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {arrastando?.tipo === 'numero' && (
          <div className="editor-posicoes-numero-arrastando" style={{ left: arrastando.x, top: arrastando.y }}>
            {arrastando.numero}
          </div>
        )}
      </div>
    </div>
  )
}
