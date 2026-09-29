'use client'

import { useEffect, useRef, useState } from 'react'
import ConfigSala, { type ConfigSalaHandle } from './ConfigSala'
import EditorPosicoesSala from './EditorPosicoesSala'
import { EQUIPES, labelEquipe } from '../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'
import type { MarcadorSala, PosicaoBaia, Sala } from '../../../types/dominio'

type Resultado = Promise<boolean> | boolean
type ResultadoId = Promise<number | false> | number | false
type DadosBaia = { equipe?: string | null; especialidade?: string | null; perfil?: string | null }
type ModoCriacao = 'unica' | 'compartilhada' | 'entre_salas'
export type ModoWizard = { modo: 'criar' } | { modo: 'editar'; id: number }

const PASSOS = [
  { n: 1, label: 'Sala' },
  { n: 2, label: 'Planta e Equipes' },
  { n: 3, label: 'Baias' },
]

// Assistente único (3 abas) pra criar ou editar uma sala — junta o que
// antes eram 4 modais separados (Criar, Editar, Ajustar posições,
// Configurar baias) numa sequência só, sempre começando da aba 1.
//
// A criação de verdade (POST /api/salas) só acontece na transição da aba
// 2 pra aba 3 — é o primeiro momento em que já sabemos nome+qtd (aba 1) E
// equipes (aba 2), que a API exige juntos. Até lá, imagem e posições ficam
// só em estado local (preview via blob URL); ao criar, tudo é enviado em
// sequência (sala → grupo de rodízio → imagem → posições).
// Editando uma sala que já existe não tem essa restrição: imagem e
// posições continuam salvando na hora, como sempre.
export default function SalaWizard({
  modoInicial,
  salas,
  minhaEquipe,
  souAdmin,
  onAlterarBaiaSala,
  onAlterarEquipesSala,
  onCriarSala,
  onEditarSala,
  onExcluirSala,
  onEnviarImagemSala,
  onRemoverImagemSala,
  onAjustarPosicoesSala,
  onAjustarMarcadoresSala,
  onCriarGrupoRodizio,
  onClose,
}: {
  modoInicial: ModoWizard
  salas: Sala[]
  minhaEquipe: string | null | undefined
  souAdmin: boolean
  onAlterarBaiaSala: (salaId: number, baia: string, valores: DadosBaia) => Resultado
  onAlterarEquipesSala: (salaId: number, equipes: string[]) => Resultado
  onCriarSala: (dados: { nome: string; qtdBaias: number; equipes: string[] }) => ResultadoId
  onEditarSala: (salaId: number, dados: { nome: string; qtdBaias: number }) => Resultado
  onExcluirSala: (salaId: number) => Resultado
  onEnviarImagemSala: (salaId: number, arquivo: File) => unknown
  onRemoverImagemSala: (salaId: number) => unknown
  onAjustarPosicoesSala: (salaId: number, posicoes: Record<string, PosicaoBaia>) => Resultado
  onAjustarMarcadoresSala: (salaId: number, marcadores: MarcadorSala[]) => Resultado
  onCriarGrupoRodizio: (dados: { nome: string; salaIds: number[]; equipes: string[] }) => Resultado
  onClose: () => void
}) {
  const criandoNovo = modoInicial.modo === 'criar'
  const salaExistenteBase = modoInicial.modo === 'editar' ? salas.find(s => s.id === modoInicial.id) : undefined

  const [passoAtual, setPassoAtual] = useState(1)
  const [wizardId, setWizardId] = useState<number | null>(modoInicial.modo === 'editar' ? modoInicial.id : null)
  const [salaPlaceholder, setSalaPlaceholder] = useState<Sala | null>(null)
  const salaAtual = (wizardId != null ? salas.find(s => s.id === wizardId) : undefined) ?? salaPlaceholder ?? salaExistenteBase ?? null

  // Aba 1
  const [modoCriacao, setModoCriacao] = useState<ModoCriacao>('unica')
  const [nome, setNome] = useState(salaExistenteBase?.nome ?? '')
  const [qtdBaias, setQtdBaias] = useState<number | string>(salaExistenteBase?.qtdBaias ?? 9)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  // Aba 2 — equipes (uma lista só: no modo Única/imagem fixa, vira rádio
  // via alternarEquipe forçando array de 1 item)
  const [equipes, setEquipes] = useState<string[]>(salaExistenteBase?.equipes ?? (minhaEquipe ? [minhaEquipe] : []))
  const [salasParaAgrupar, setSalasParaAgrupar] = useState<number[]>([])
  const [nomeRodizio, setNomeRodizio] = useState('')

  // Aba 2 — imagem/posições. Ao editar, salvam na hora (como sempre). Ao
  // criar, ficam só em memória até a sala existir de fato.
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const [arquivoImagem, setArquivoImagem] = useState<File | null>(null)
  const [previewImagemUrl, setPreviewImagemUrl] = useState<string | null>(null)
  const [posicoesStaged, setPosicoesStaged] = useState<Record<string, PosicaoBaia>>({})
  const [marcadoresStaged, setMarcadoresStaged] = useState<MarcadorSala[]>([])

  const [salvandoPasso, setSalvandoPasso] = useState(false)

  const configSalaRef = useRef<ConfigSalaHandle>(null)

  useEffect(() => {
    return () => {
      if (previewImagemUrl) URL.revokeObjectURL(previewImagemUrl)
    }
  }, [previewImagemUrl])

  const imagemFixaAtual = salaAtual?.imagem === IMAGEM_COM_POSICOES_CONHECIDAS
  const equipeUnicaObrigatoria = criandoNovo ? modoCriacao === 'unica' : imagemFixaAtual

  const alternarEquipe = (slug: string) => {
    if (equipeUnicaObrigatoria) {
      setEquipes([slug])
      return
    }
    setEquipes(prev => prev.includes(slug) ? prev.filter(e => e !== slug) : [...prev, slug])
  }

  const alternarSalaParaAgrupar = (id: number) => {
    setSalasParaAgrupar(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  // Salas com mapa de posições fixas só suportam 1 equipe (não entram em
  // rodízio entre salas); as que já fazem parte de outro grupo também não.
  const salasElegiveisParaAgrupar = salas.filter(s => s.imagem !== IMAGEM_COM_POSICOES_CONHECIDAS && !s.grupoRodizio)

  const passo1Valido = (() => {
    if (!nome.trim()) return false
    const q = Number(qtdBaias)
    return Number.isInteger(q) && q >= 1 && q <= 50
  })()

  const passo2Valido = (() => {
    if (equipeUnicaObrigatoria) return equipes.length === 1
    if (criandoNovo && modoCriacao === 'entre_salas') {
      return equipes.length > 0 && salasParaAgrupar.length > 0 && nomeRodizio.trim() !== ''
    }
    if (criandoNovo && modoCriacao === 'compartilhada') return equipes.length >= 2
    return equipes.length > 0
  })()

  const escolherArquivoImagem = (arquivo: File | undefined) => {
    if (!arquivo) return
    if (previewImagemUrl) URL.revokeObjectURL(previewImagemUrl)
    setArquivoImagem(arquivo)
    setPreviewImagemUrl(URL.createObjectURL(arquivo))
    setPosicoesStaged({})
    setMarcadoresStaged([])
  }

  const removerImagemStaged = () => {
    if (previewImagemUrl) URL.revokeObjectURL(previewImagemUrl)
    setArquivoImagem(null)
    setPreviewImagemUrl(null)
    setPosicoesStaged({})
    setMarcadoresStaged([])
  }

  const enviarImagemImediato = async (arquivo: File | undefined) => {
    if (!arquivo || !wizardId) return
    setEnviandoImagem(true)
    try {
      await onEnviarImagemSala(wizardId, arquivo)
    } finally {
      setEnviandoImagem(false)
    }
  }

  const removerImagemImediato = async () => {
    if (!wizardId) return
    setEnviandoImagem(true)
    try {
      await onRemoverImagemSala(wizardId)
    } finally {
      setEnviandoImagem(false)
    }
  }

  const irParaPasso2 = async () => {
    if (criandoNovo) {
      setPassoAtual(2)
      return
    }
    if (!wizardId || !salaAtual) return
    const mudou = nome.trim() !== salaAtual.nome || Number(qtdBaias) !== salaAtual.qtdBaias
    if (mudou) {
      setSalvandoPasso(true)
      const ok = await onEditarSala(wizardId, { nome: nome.trim(), qtdBaias: Number(qtdBaias) })
      setSalvandoPasso(false)
      if (!ok) return
    }
    setPassoAtual(2)
  }

  const irParaPasso3 = async () => {
    setSalvandoPasso(true)
    try {
      if (criandoNovo) {
        const novoId = await onCriarSala({ nome: nome.trim(), qtdBaias: Number(qtdBaias), equipes })
        if (!novoId) return
        if (modoCriacao === 'entre_salas') {
          await onCriarGrupoRodizio({ nome: nomeRodizio.trim(), salaIds: [novoId, ...salasParaAgrupar], equipes })
        }
        if (arquivoImagem) {
          await onEnviarImagemSala(novoId, arquivoImagem)
        }
        if (Object.keys(posicoesStaged).length > 0) {
          await onAjustarPosicoesSala(novoId, posicoesStaged)
        }
        if (marcadoresStaged.length > 0) {
          await onAjustarMarcadoresSala(novoId, marcadoresStaged)
        }
        setSalaPlaceholder({
          id: novoId,
          nome: nome.trim(),
          imagem: previewImagemUrl,
          imagemHash: null,
          qtdBaias: Number(qtdBaias),
          equipes,
          modoReserva: modoCriacao === 'entre_salas' ? 'entre_salas' : (equipes.length > 1 ? 'equipe' : 'perfil'),
          podeEditar: true,
          baias: {},
          posicoes: posicoesStaged,
          marcadores: marcadoresStaged,
          grupoRodizio: null,
        })
        setWizardId(novoId)
      } else {
        if (!wizardId || !salaAtual) return
        const equipesMudaram = JSON.stringify([...equipes].sort()) !== JSON.stringify([...salaAtual.equipes].sort())
        if (equipesMudaram) {
          const ok = await onAlterarEquipesSala(wizardId, equipes)
          if (!ok) return
        }
      }
      setPassoAtual(3)
    } finally {
      setSalvandoPasso(false)
    }
  }

  const concluir = async () => {
    const ref = configSalaRef.current
    if (!ref) {
      onClose()
      return
    }
    setSalvandoPasso(true)
    const ok = await ref.salvar()
    setSalvandoPasso(false)
    if (ok) onClose()
  }

  const excluir = async () => {
    if (!wizardId) return
    setSalvandoPasso(true)
    const ok = await onExcluirSala(wizardId)
    setSalvandoPasso(false)
    if (ok) onClose()
  }

  const mostrarPosicoesCriacao = criandoNovo && !!previewImagemUrl
  const mostrarPosicoesEdicao = !criandoNovo && !!salaAtual?.imagem && !imagemFixaAtual

  const salaParaPosicoesCriacao: Sala | null = mostrarPosicoesCriacao
    ? {
        id: -1,
        nome: nome.trim() || 'Nova sala',
        imagem: previewImagemUrl,
        imagemHash: null,
        qtdBaias: Number(qtdBaias) || 9,
        equipes: [],
        modoReserva: 'perfil',
        podeEditar: true,
        baias: {},
        posicoes: posicoesStaged,
        marcadores: marcadoresStaged,
        grupoRodizio: null,
      }
    : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${passoAtual >= 2 ? 'modal-content-largo' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{criandoNovo ? '➕ Nova Sala' : `⚙️ ${salaAtual?.nome ?? ''}`}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="auto-passos">
          {PASSOS.map(p => (
            <div
              key={p.n}
              className={`auto-passo ${passoAtual === p.n ? 'atual' : ''} ${passoAtual > p.n ? 'concluido' : ''}`}
              onClick={() => { if (p.n < passoAtual) setPassoAtual(p.n) }}
            >
              <span className="auto-passo-numero">{passoAtual > p.n ? '✓' : p.n}</span>
              <span className="auto-passo-label">{p.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          {/* ABA 1 — SALA */}
          {passoAtual === 1 && (
            <>
              {criandoNovo && (
                <div className="form-group">
                  <label>Formato</label>
                  <div className="auto-chip-row">
                    <button type="button" className={`auto-chip ${modoCriacao === 'unica' ? 'ativo' : ''}`} onClick={() => setModoCriacao('unica')}>
                      Sala Única
                    </button>
                    <button type="button" className={`auto-chip ${modoCriacao === 'compartilhada' ? 'ativo' : ''}`} onClick={() => setModoCriacao('compartilhada')}>
                      Sala Compartilhada
                    </button>
                    <button type="button" className={`auto-chip ${modoCriacao === 'entre_salas' ? 'ativo' : ''}`} onClick={() => setModoCriacao('entre_salas')}>
                      Entre Salas
                    </button>
                  </div>
                  <small className="auto-campo-ajuda">
                    {modoCriacao === 'unica' && 'Uma equipe só usa essa sala — o rodízio dela fica só aqui dentro.'}
                    {modoCriacao === 'compartilhada' && '2 ou mais equipes dividem as baias dessa mesma sala.'}
                    {modoCriacao === 'entre_salas' && 'Uma ou mais equipes se revezam entre essa sala nova e uma ou mais salas já existentes.'}
                  </small>
                </div>
              )}

              <div className="form-group" style={{ marginTop: 15 }}>
                <label>Nome da sala</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Sala Sistemas" />
              </div>

              <div className="form-group" style={{ marginTop: 15 }}>
                <label>Quantidade de baias</label>
                <input type="number" min="1" max="50" value={qtdBaias} onChange={(e) => setQtdBaias(e.target.value)} />
              </div>

              {!passo1Valido && (
                <small className="auto-campo-alerta">Dê um nome à sala e uma quantidade de baias válida (1 a 50) pra continuar.</small>
              )}
            </>
          )}

          {/* ABA 2 — PLANTA E EQUIPES */}
          {passoAtual === 2 && (
            <>
              <p className="config-baias-explicacao">
                {equipeUnicaObrigatoria ? 'Escolha a equipe dessa sala.' : 'Escolha quais equipes fazem parte dessa sala.'}
              </p>
              <div className="config-baias-lista">
                {EQUIPES.map(eq => (
                  <label key={eq.id} className="campo-toggle">
                    {equipeUnicaObrigatoria ? (
                      <input
                        type="radio"
                        name="sala-wizard-equipe-unica"
                        checked={equipes[0] === eq.id}
                        onChange={() => alternarEquipe(eq.id)}
                      />
                    ) : (
                      <span className="toggle-switch">
                        <input type="checkbox" checked={equipes.includes(eq.id)} onChange={() => alternarEquipe(eq.id)} />
                        <span className="toggle-switch-slider"></span>
                      </span>
                    )}
                    <span>{eq.label}</span>
                  </label>
                ))}
              </div>

              {criandoNovo && modoCriacao === 'entre_salas' && (
                <>
                  <div className="form-group" style={{ marginTop: 15 }}>
                    <label>Nome do rodízio entre salas</label>
                    <input type="text" value={nomeRodizio} onChange={(e) => setNomeRodizio(e.target.value)} placeholder="Ex: Rodízio Infra/Sistemas" />
                  </div>
                  <p className="config-baias-explicacao" style={{ marginTop: 15 }}>Escolha com qual(is) sala(s) já existente(s) essa sala nova vai revezar.</p>
                  <div className="config-baias-lista">
                    {salasElegiveisParaAgrupar.length === 0 && (
                      <p className="campo-nota">Nenhuma sala existente disponível pra agrupar.</p>
                    )}
                    {salasElegiveisParaAgrupar.map(s => (
                      <label key={s.id} className="campo-toggle">
                        <span className="toggle-switch">
                          <input type="checkbox" checked={salasParaAgrupar.includes(s.id)} onChange={() => alternarSalaParaAgrupar(s.id)} />
                          <span className="toggle-switch-slider"></span>
                        </span>
                        <span>{s.nome}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginTop: 20 }}>
                <label>Imagem do mapa (opcional)</label>
                {criandoNovo ? (
                  <>
                    {previewImagemUrl && (
                      <img src={previewImagemUrl} alt="Prévia da planta" className="painel-salas-imagem-preview" />
                    )}
                    <input type="file" accept="image/*" onChange={(e) => escolherArquivoImagem(e.target.files?.[0])} />
                    {previewImagemUrl && (
                      <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={removerImagemStaged}>
                        🗑️ Remover imagem
                      </button>
                    )}
                    <p className="campo-nota">A imagem e as posições marcadas abaixo só são enviadas quando você clicar em "Próximo".</p>
                  </>
                ) : (
                  <>
                    {salaAtual?.imagem && (
                      <img src={salaAtual.imagem} alt={`Mapa de ${salaAtual.nome}`} className="painel-salas-imagem-preview" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={enviandoImagem}
                      onChange={(e) => enviarImagemImediato(e.target.files?.[0])}
                    />
                    {salaAtual?.imagem && (
                      <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={removerImagemImediato} disabled={enviandoImagem}>
                        {enviandoImagem ? 'Removendo...' : '🗑️ Remover imagem'}
                      </button>
                    )}
                    {imagemFixaAtual && (
                      <p className="campo-nota">Essa sala usa um mapa com posições fixas — não dá pra ajustar posições nela.</p>
                    )}
                  </>
                )}
              </div>

              {mostrarPosicoesCriacao && salaParaPosicoesCriacao && (
                <div className="form-group" style={{ marginTop: 15 }}>
                  <label>Ajustar posições das baias</label>
                  <EditorPosicoesSala
                    sala={salaParaPosicoesCriacao}
                    embutido
                    onMudarControlado={(posicoes, marcadores) => { setPosicoesStaged(posicoes); setMarcadoresStaged(marcadores) }}
                    onClose={() => {}}
                  />
                </div>
              )}

              {mostrarPosicoesEdicao && salaAtual && wizardId && (
                <div className="form-group" style={{ marginTop: 15 }}>
                  <label>Ajustar posições das baias</label>
                  <EditorPosicoesSala
                    sala={salaAtual}
                    todasAsSalas={salas}
                    embutido
                    onSalvarPosicoes={(posicoes) => onAjustarPosicoesSala(wizardId, posicoes)}
                    onSalvarMarcadores={(marcadores) => onAjustarMarcadoresSala(wizardId, marcadores)}
                    onClose={() => {}}
                  />
                </div>
              )}

              {!passo2Valido && (
                <small className="auto-campo-alerta">
                  {criandoNovo && modoCriacao === 'entre_salas'
                    ? 'Escolha a(s) equipe(s), o nome do rodízio e pelo menos 1 sala pra agrupar.'
                    : criandoNovo && modoCriacao === 'compartilhada'
                    ? 'Escolha pelo menos 2 equipes.'
                    : 'Escolha pelo menos uma equipe.'}
                </small>
              )}
            </>
          )}

          {/* ABA 3 — BAIAS */}
          {passoAtual === 3 && salaAtual && (
            <ConfigSala
              ref={configSalaRef}
              sala={salaAtual}
              minhaEquipe={minhaEquipe}
              souAdmin={souAdmin}
              embutido
              onAlterarBaia={(baia, valores) => onAlterarBaiaSala(salaAtual.id, baia, valores)}
              onAjustarPosicoes={() => setPassoAtual(2)}
              onClose={() => {}}
            />
          )}
        </div>

        <div className="form-actions-modal">
          {!criandoNovo && passoAtual === 1 && (
            <button type="button" className="btn-deletar" onClick={() => setConfirmandoExclusao(true)} disabled={salvandoPasso}>
              🗑️ Excluir sala
            </button>
          )}
          {passoAtual > 1 && (
            <button type="button" className="btn-secondary" onClick={() => setPassoAtual(p => p - 1)} disabled={salvandoPasso}>
              ← Voltar
            </button>
          )}
          {passoAtual < 3 && (
            <button
              type="button"
              className="btn-success"
              disabled={salvandoPasso || (passoAtual === 1 && !passo1Valido) || (passoAtual === 2 && !passo2Valido)}
              onClick={passoAtual === 1 ? irParaPasso2 : irParaPasso3}
            >
              {salvandoPasso ? 'Salvando...' : 'Próximo →'}
            </button>
          )}
          {passoAtual === 3 && (
            <button type="button" className="btn-success" disabled={salvandoPasso} onClick={concluir}>
              {salvandoPasso ? 'Salvando...' : '✅ Concluir'}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={salvandoPasso}>
            {passoAtual === 3 ? 'Fechar' : 'Cancelar'}
          </button>
        </div>

        {confirmandoExclusao && (
          <div className="confirm-overlay" onClick={() => setConfirmandoExclusao(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Excluir "{salaAtual?.nome}"?</h4>
              <p>Isso apaga a sala e todas as reservas de baia dela. Não dá pra desfazer.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-secondary" onClick={() => setConfirmandoExclusao(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn-deletar" onClick={excluir}>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
