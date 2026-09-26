'use client'

import { useState } from 'react'
import { POSICOES_BAIA } from './MapaBaias'
import EditorPosicoesSala, { emojiDoMarcador } from './EditorPosicoesSala'
import { EQUIPES, labelEquipe, PERFIS, especialidadesPorEquipe } from '../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'
import type { Sala, ConfigBaia, MarcadorSala, PosicaoBaia } from '../../../types/dominio'

type DadosBaia = { equipe?: string | null; especialidade?: string | null; perfil?: string | null }
type Resultado = Promise<boolean> | boolean

function valorVazio(sala: Sala): ConfigBaia {
  return sala.modoReserva === 'equipe' ? { equipe: '', especialidade: '' } : { perfil: '' }
}

function baiasIguais(a: ConfigBaia | undefined, b: ConfigBaia | undefined, modoReserva: string): boolean {
  if (modoReserva === 'equipe') {
    return (a?.equipe || '') === (b?.equipe || '') && (a?.especialidade || '') === (b?.especialidade || '')
  }
  return (a?.perfil || '') === (b?.perfil || '')
}

const PASSOS = [
  { n: 1, label: 'Detalhes' },
  { n: 2, label: 'Planta' },
  { n: 3, label: 'Baias' },
]

// Um único fluxo (atrás da engrenagem ⚙️) pra configurar uma sala do início
// ao fim, em vez de duas telas soltas (nome/imagem de um lado, baias de
// outro): 1) nome e quantidade de baias, 2) imagem + posições + quais
// equipes usam a sala, 3) pra qual equipe/perfil cada baia é reservada.
// Cada "Próximo"/"Voltar" já salva o que mudou naquele passo antes de
// navegar — nunca fica nada pendente escondido entre os passos.
export default function ConfigurarSala({ sala, minhaEquipe, souAdmin, onSalvarDetalhes, onSalvarEquipes, onExcluir, onEnviarImagem, onRemoverImagem, onSalvarPosicoes, onSalvarMarcadores, onAlterarBaia, todasAsSalas, onClose }: {
  sala: Sala
  minhaEquipe: string | null | undefined
  souAdmin: boolean
  onSalvarDetalhes: (salaId: number, dados: { nome: string; qtdBaias: number }) => Resultado
  onSalvarEquipes: (salaId: number, equipes: string[]) => Resultado
  onExcluir: (salaId: number) => Resultado
  onEnviarImagem: (salaId: number, arquivo: File) => unknown
  onRemoverImagem: (salaId: number) => unknown
  onSalvarPosicoes: (posicoes: Record<string, PosicaoBaia>) => Resultado
  onSalvarMarcadores: (marcadores: MarcadorSala[]) => Resultado
  onAlterarBaia: (baia: string, dados: DadosBaia) => Resultado
  todasAsSalas: Sala[]
  onClose: () => void
}) {
  const [passoAtual, setPassoAtual] = useState(1)

  // Passo 1 — detalhes
  const [nome, setNome] = useState(sala.nome)
  const [qtdBaias, setQtdBaias] = useState<number | string>(sala.qtdBaias)
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  // Passo 2 — planta e equipes
  const imagemFixa = sala.imagem === IMAGEM_COM_POSICOES_CONHECIDAS
  const [equipes, setEquipes] = useState<string[]>(sala.equipes)
  const [salvandoEquipes, setSalvandoEquipes] = useState(false)
  const [enviandoImagem, setEnviandoImagem] = useState(false)
  const [ajustandoPosicoes, setAjustandoPosicoes] = useState(false)
  const numerosBaiaPlanta = Array.from({ length: sala.qtdBaias || 9 }, (_, i) => String(i + 1))
  const posicoesCompletas = !imagemFixa && !!sala.imagem && numerosBaiaPlanta.every(n => sala.posicoes?.[n])

  // Passo 3 — reserva das baias
  const [valoresBaia, setValoresBaia] = useState<Record<string, ConfigBaia>>(sala.baias)
  const [salvandoBaias, setSalvandoBaias] = useState(false)
  const mostrarMapaFixo = imagemFixa
  const numerosBaiaConfig = mostrarMapaFixo ? Object.keys(POSICOES_BAIA) : numerosBaiaPlanta
  const posicoesProprias = sala.posicoes || {}
  const temMapaProprio = !mostrarMapaFixo && !!sala.imagem && numerosBaiaConfig.every(b => posicoesProprias[b])
  const mostrarMapaConfig = mostrarMapaFixo || temMapaProprio
  const posicoesParaUsar = mostrarMapaFixo ? POSICOES_BAIA : posicoesProprias
  const equipesQuePossoEscolher = souAdmin ? sala.equipes : sala.equipes.filter(e => e === minhaEquipe)
  const todasAsBaias = new Set([...Object.keys(sala.baias), ...Object.keys(valoresBaia)])
  const baiasAlteradas = [...todasAsBaias].some(baia => !baiasIguais(sala.baias[baia], valoresBaia[baia], sala.modoReserva))

  // O que ainda não foi salvo no passo em que a pessoa está agora — clicar
  // fora da caixa (ou em "Fechar") não pode simplesmente sumir com isso
  // sem avisar, do jeito que as outras telas de sala sempre avisaram.
  const equipesAlteradas = JSON.stringify([...equipes].sort()) !== JSON.stringify([...sala.equipes].sort())
  const alteradoNoPassoAtual =
    passoAtual === 1 ? (nome.trim() !== sala.nome || Number(qtdBaias) !== sala.qtdBaias) :
    passoAtual === 2 ? equipesAlteradas :
    baiasAlteradas

  const tentarFechar = () => {
    if (salvandoDetalhes || salvandoEquipes || salvandoBaias) return
    if (alteradoNoPassoAtual) {
      setConfirmandoSaida(true)
      return
    }
    onClose()
  }

  const alternarEquipe = (slug: string) => {
    if (imagemFixa) {
      setEquipes([slug])
      return
    }
    setEquipes(prev => prev.includes(slug) ? prev.filter(e => e !== slug) : [...prev, slug])
  }

  const salvarDetalhesEIr = async (proximoPasso: number) => {
    if (!nome.trim()) {
      alert('Dê um nome pra sala.')
      return
    }
    setSalvandoDetalhes(true)
    try {
      const mudou = nome.trim() !== sala.nome || Number(qtdBaias) !== sala.qtdBaias
      const ok = mudou ? await onSalvarDetalhes(sala.id, { nome: nome.trim(), qtdBaias: Number(qtdBaias) }) : true
      if (ok) setPassoAtual(proximoPasso)
    } finally {
      setSalvandoDetalhes(false)
    }
  }

  const salvarEquipesEIr = async (proximoPasso: number) => {
    if (equipes.length === 0) {
      alert('Escolha pelo menos uma equipe.')
      return
    }
    setSalvandoEquipes(true)
    try {
      const mudou = JSON.stringify([...equipes].sort()) !== JSON.stringify([...sala.equipes].sort())
      const ok = mudou ? await onSalvarEquipes(sala.id, equipes) : true
      if (ok) setPassoAtual(proximoPasso)
    } finally {
      setSalvandoEquipes(false)
    }
  }

  const salvarBaiasE = async (depois: 'fechar' | 2) => {
    setSalvandoBaias(true)
    try {
      let tudoOk = true
      for (const baia of todasAsBaias) {
        const antes = sala.baias[baia] || valorVazio(sala)
        const depoisValor = valoresBaia[baia] || valorVazio(sala)
        if (!baiasIguais(antes, depoisValor, sala.modoReserva)) {
          const ok = sala.modoReserva === 'equipe'
            ? await onAlterarBaia(baia, { equipe: depoisValor.equipe || null, especialidade: depoisValor.especialidade || null })
            : await onAlterarBaia(baia, { perfil: depoisValor.perfil || null })
          if (!ok) tudoOk = false
        }
      }
      if (tudoOk) {
        if (depois === 'fechar') onClose()
        else setPassoAtual(depois)
      }
    } finally {
      setSalvandoBaias(false)
    }
  }

  const excluir = async () => {
    setSalvandoDetalhes(true)
    try {
      const ok = await onExcluir(sala.id)
      if (ok) onClose()
    } finally {
      setSalvandoDetalhes(false)
    }
  }

  const enviarImagem = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setEnviandoImagem(true)
    try {
      await onEnviarImagem(sala.id, arquivo)
    } finally {
      setEnviandoImagem(false)
    }
  }

  const removerImagem = async () => {
    setEnviandoImagem(true)
    try {
      await onRemoverImagem(sala.id)
    } finally {
      setEnviandoImagem(false)
    }
  }

  const alterarPerfilBaia = (baia: string, perfil: string) => {
    setValoresBaia(prev => {
      const proximo = { ...prev }
      if (perfil) proximo[baia] = { perfil }
      else delete proximo[baia]
      return proximo
    })
  }

  const alterarEquipeBaia = (baia: string, equipe: string) => {
    setValoresBaia(prev => {
      const proximo = { ...prev }
      if (equipe) proximo[baia] = { equipe, especialidade: '' }
      else delete proximo[baia]
      return proximo
    })
  }

  const alterarEspecialidadeBaia = (baia: string, especialidade: string) => {
    setValoresBaia(prev => ({ ...prev, [baia]: { ...prev[baia], especialidade } }))
  }

  const renderCamposBaia = (baia: string) => {
    const valor = valoresBaia[baia] || valorVazio(sala)

    if (sala.modoReserva === 'perfil') {
      return (
        <select
          value={valor.perfil || ''}
          disabled={salvandoBaias}
          onChange={(e) => alterarPerfilBaia(baia, e.target.value)}
          title={baia === '0' ? 'Supervisor' : `Baia ${baia}`}
        >
          <option value="">— Sem restrição —</option>
          <option value="supervisor">⭐ Supervisor</option>
          {PERFIS.filter(p => p.id !== 'admin').map(perfil => (
            <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
          ))}
        </select>
      )
    }

    const donoOutraEquipe = valor.equipe && !equipesQuePossoEscolher.includes(valor.equipe)
    if (donoOutraEquipe) {
      return (
        <span className="config-baia-linha-travada">
          🔒 {labelEquipe(valor.equipe)}{valor.especialidade ? ` · ${valor.especialidade}` : ' · qualquer um da equipe'}
        </span>
      )
    }

    const especialidadesDaEquipe = valor.equipe ? especialidadesPorEquipe(valor.equipe) : []
    return (
      <>
        <select value={valor.equipe || ''} disabled={salvandoBaias} onChange={(e) => alterarEquipeBaia(baia, e.target.value)}>
          <option value="">— Livre —</option>
          {equipesQuePossoEscolher.map(eq => (
            <option key={eq} value={eq}>{labelEquipe(eq)}</option>
          ))}
        </select>
        {valor.equipe && (
          <select value={valor.especialidade || ''} disabled={salvandoBaias} onChange={(e) => alterarEspecialidadeBaia(baia, e.target.value)}>
            <option value="">— Qualquer especialidade da equipe —</option>
            {especialidadesDaEquipe.map(esp => (
              <option key={esp} value={esp}>{esp}</option>
            ))}
          </select>
        )}
      </>
    )
  }

  if (ajustandoPosicoes) {
    return (
      <EditorPosicoesSala
        sala={sala}
        todasAsSalas={todasAsSalas}
        onSalvarPosicoes={onSalvarPosicoes}
        onSalvarMarcadores={onSalvarMarcadores}
        onClose={() => setAjustandoPosicoes(false)}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={tentarFechar}>
      <div className={`modal-content ${passoAtual === 3 && mostrarMapaConfig ? 'modal-content-largo' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙️ {sala.nome}</h3>
          <button className="modal-close" onClick={tentarFechar}>✕</button>
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
          {/* PASSO 1 — NOME E QUANTIDADE DE BAIAS */}
          {passoAtual === 1 && (
            <>
              <div className="form-group">
                <label>Nome da sala</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvandoDetalhes} />
              </div>

              {imagemFixa ? (
                <p className="campo-nota" style={{ marginTop: 15 }}>
                  Essa sala usa um mapa com posições fixas (baias 0 a 9) — a quantidade de baias não se aplica aqui.
                </p>
              ) : (
                <div className="form-group" style={{ marginTop: 15 }}>
                  <label>Quantidade de baias</label>
                  <input type="number" min="1" max="50" value={qtdBaias} onChange={(e) => setQtdBaias(e.target.value)} disabled={salvandoDetalhes} />
                </div>
              )}
            </>
          )}

          {/* PASSO 2 — PLANTA, POSIÇÕES E EQUIPES */}
          {passoAtual === 2 && (
            <>
              <div className="form-group">
                <label>Imagem do mapa (opcional)</label>
                {sala.imagem && (
                  <img src={sala.imagem} alt={`Mapa de ${sala.nome}`} className="painel-salas-imagem-preview" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={enviandoImagem}
                  onChange={(e) => enviarImagem(e.target.files?.[0])}
                />
                {sala.imagem && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {!imagemFixa && (
                      <button type="button" className="btn-secondary" onClick={() => setAjustandoPosicoes(true)} disabled={enviandoImagem}>
                        📍 Ajustar posições das baias
                      </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={removerImagem} disabled={enviandoImagem}>
                      {enviandoImagem ? 'Removendo...' : '🗑️ Remover imagem'}
                    </button>
                  </div>
                )}
                {!imagemFixa && sala.imagem && (
                  <p className="campo-nota">
                    {posicoesCompletas
                      ? 'Mapa visual configurado — use "Ajustar posições" se quiser mudar.'
                      : 'Ainda falta marcar a posição de alguma baia na planta — use "Ajustar posições" pra virar mapa visual clicável.'}
                  </p>
                )}
              </div>

              <p className="config-baias-explicacao" style={{ marginTop: 15 }}>
                Marque quais equipes usam essa sala. Com 1 equipe só, a reserva das baias é por perfil; com 2 ou mais, vira por equipe. Se tirar uma equipe daqui, as baias que ela tinha reivindicado nessa sala ficam livres de novo.
              </p>
              {imagemFixa && (
                <p className="campo-nota">Essa sala usa um mapa com posições fixas — só pode ter uma equipe vinculada.</p>
              )}
              <div className="config-baias-lista">
                {EQUIPES.map(eq => (
                  <label key={eq.id} className="campo-toggle">
                    {imagemFixa ? (
                      <input
                        type="radio"
                        name={`equipe-sala-${sala.id}`}
                        checked={equipes[0] === eq.id}
                        disabled={salvandoEquipes}
                        onChange={() => alternarEquipe(eq.id)}
                      />
                    ) : (
                      <span className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={equipes.includes(eq.id)}
                          disabled={salvandoEquipes}
                          onChange={() => alternarEquipe(eq.id)}
                        />
                        <span className="toggle-switch-slider"></span>
                      </span>
                    )}
                    <span>{eq.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* PASSO 3 — QUAL EQUIPE/PERFIL FICA EM CADA BAIA */}
          {passoAtual === 3 && (
            <>
              <p className="config-baias-explicacao">
                {sala.modoReserva === 'equipe' ? (
                  <>Essa sala é dividida por {sala.equipes.map(labelEquipe).join(', ')}. Cada gestor só reivindica baia livre ou já reivindicada pela própria equipe — baias de outra equipe aparecem travadas. Escolha a equipe e, se quiser, uma especialidade específica dela.</>
                ) : (
                  <>Escolha, pra cada baia, se ela é exclusiva de algum perfil (ou do Supervisor). Baias de <strong>Estag/Aprendiz</strong> ou <strong>Trainee</strong> comportam até 2 pessoas por dia (manhã e tarde). Só uma baia pode ser a do <strong>⭐ Supervisor</strong> por vez.</>
                )}
                <br />
                Cada escolha só salva quando você clicar em <strong>Concluir</strong>.
              </p>

              {!mostrarMapaConfig && sala.imagem && (
                <p className="campo-nota" style={{ marginBottom: 10 }}>
                  Essa sala já tem planta, mas as posições de alguma baia ainda não foram marcadas — volte ao passo "Planta" e use "Ajustar posições" pra virar mapa visual clicável.
                </p>
              )}

              {mostrarMapaConfig ? (
                <div className="mapa-baias-wrapper">
                  <img src={sala.imagem ?? undefined} alt={`Mapa da ${sala.nome}`} className="mapa-baias-imagem" />
                  {numerosBaiaConfig.map(baia => (
                    <div key={baia} className="config-baia-mapa-item" style={posicoesParaUsar[baia]}>
                      {renderCamposBaia(baia)}
                    </div>
                  ))}
                  {sala.marcadores?.map(m => (
                    <div key={m.id} className="editor-marcador-item" style={{ top: m.top, left: m.left }}>
                      <span className="editor-marcador-icone">{emojiDoMarcador(m.tipo)}</span>
                      <span className="editor-marcador-rotulo">{m.rotulo}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="config-baias-lista">
                  {numerosBaiaConfig.map(baia => (
                    <div key={baia} className="config-baia-linha">
                      <span className="config-baia-linha-numero">Baia {baia}</span>
                      {renderCamposBaia(baia)}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-actions-modal">
          {passoAtual === 1 && (
            <button type="button" className="btn-deletar" onClick={() => setConfirmandoExclusao(true)} disabled={salvandoDetalhes}>
              🗑️ Excluir sala
            </button>
          )}
          {passoAtual > 1 && (
            <button
              type="button"
              className="btn-secondary"
              disabled={passoAtual === 2 ? salvandoEquipes : salvandoBaias}
              onClick={() => passoAtual === 2 ? salvarEquipesEIr(1) : salvarBaiasE(2)}
            >
              ← Voltar
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={tentarFechar}>
            Fechar
          </button>
          {passoAtual === 1 && (
            <button type="button" className="btn-primary" disabled={salvandoDetalhes} onClick={() => salvarDetalhesEIr(2)}>
              {salvandoDetalhes ? 'Salvando...' : 'Próximo →'}
            </button>
          )}
          {passoAtual === 2 && (
            <button type="button" className="btn-primary" disabled={salvandoEquipes} onClick={() => salvarEquipesEIr(3)}>
              {salvandoEquipes ? 'Salvando...' : 'Próximo →'}
            </button>
          )}
          {passoAtual === 3 && (
            <button type="button" className="btn-primary" disabled={salvandoBaias} onClick={() => salvarBaiasE('fechar')}>
              {salvandoBaias ? 'Salvando...' : (baiasAlteradas ? '💾 Concluir' : 'Concluir')}
            </button>
          )}
        </div>

        {confirmandoExclusao && (
          <div className="confirm-overlay" onClick={() => setConfirmandoExclusao(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Excluir "{sala.nome}"?</h4>
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

        {confirmandoSaida && (
          <div className="confirm-overlay" onClick={() => setConfirmandoSaida(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Sair sem salvar?</h4>
              <p>Você mudou algo nesse passo que ainda não foi salvo. Se sair agora, essa mudança será perdida.</p>
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
      </div>
    </div>
  )
}
