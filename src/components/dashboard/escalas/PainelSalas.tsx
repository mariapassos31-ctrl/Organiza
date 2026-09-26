'use client'

import { useState, type ComponentProps } from 'react'
import type { MarcadorSala, PosicaoBaia, Sala } from '../../../types/dominio'
import ConfigurarSala from './ConfigurarSala'
import VisualizarSala from './VisualizarSala'
import ConfigLaboratorio from './ConfigLaboratorio'
import { EQUIPES, labelEquipe } from '../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'

// Painel único de espaços físicos — lista as salas (e o Laboratório) que
// a pessoa pode configurar, deixa criar uma sala nova (cada equipe tem seu
// próprio layout) e abre a tela certa pra cada um. Cada sala já decide
// sozinha (na API) se é mapa visual ou lista, e se a reserva é por perfil
// ou por equipe — quem já é da sala controla isso mudando a lista de
// equipes vinculadas (botão ⚙️).
type Resultado = Promise<boolean> | boolean
type ResultadoId = Promise<number | false> | number | false
type DadosBaia = { equipe?: string | null; especialidade?: string | null; perfil?: string | null }
type Aberto = { tipo: "visualizar"; id: number } | { tipo: "laboratorio" } | null

interface PainelSalasProps {
  salas: Sala[]
  podeConfigurarLaboratorio: boolean
  laboratorioProps: Omit<ComponentProps<typeof ConfigLaboratorio>, "onClose">
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
}

export default function PainelSalas({ salas, podeConfigurarLaboratorio, laboratorioProps, minhaEquipe, souAdmin, onAlterarBaiaSala, onAlterarEquipesSala, onCriarSala, onEditarSala, onExcluirSala, onEnviarImagemSala, onRemoverImagemSala, onAjustarPosicoesSala, onAjustarMarcadoresSala, onCriarGrupoRodizio, onClose }: PainelSalasProps) {
  const [abrindo, setAbrindo] = useState<Aberto>(null)
  const [editandoSalaDe, setEditandoSalaDe] = useState<Sala | null>(null)
  const [criandoSala, setCriandoSala] = useState(false)

  const salasVisiveis = salas.filter(s => s.podeEditar)

  if (abrindo?.tipo === 'visualizar') {
    const sala = salas.find(s => s.id === abrindo.id)
    if (!sala) return null
    return (
      <VisualizarSala
        sala={sala}
        onConfigurar={() => { setAbrindo(null); setEditandoSalaDe(sala) }}
        onClose={() => setAbrindo(null)}
      />
    )
  }

  if (abrindo?.tipo === 'laboratorio') {
    return <ConfigLaboratorio {...laboratorioProps} onClose={() => setAbrindo(null)} />
  }

  if (editandoSalaDe) {
    // Deriva da lista viva de salas (não do snapshot que abriu a tela) —
    // assim, depois de um upload de imagem, o preview atualiza sozinho.
    const salaAtual = salas.find(s => s.id === editandoSalaDe.id) || editandoSalaDe
    return (
      <ConfigurarSala
        sala={salaAtual}
        minhaEquipe={minhaEquipe}
        souAdmin={souAdmin}
        onSalvarDetalhes={onEditarSala}
        onSalvarEquipes={onAlterarEquipesSala}
        onExcluir={onExcluirSala}
        onEnviarImagem={onEnviarImagemSala}
        onRemoverImagem={onRemoverImagemSala}
        onSalvarPosicoes={(posicoes) => onAjustarPosicoesSala(salaAtual.id, posicoes)}
        onSalvarMarcadores={(marcadores) => onAjustarMarcadoresSala(salaAtual.id, marcadores)}
        onAlterarBaia={(baia, valores) => onAlterarBaiaSala(salaAtual.id, baia, valores)}
        todasAsSalas={salas}
        onClose={() => setEditandoSalaDe(null)}
      />
    )
  }

  if (criandoSala) {
    // Depois de criar, já abre a edição dela — é onde dá pra subir a
    // imagem. A sala real ainda não chegou na lista (o pai só recarrega
    // depois), então usa um placeholder com o que já se sabe; assim que a
    // lista de verdade atualizar, o fallback do "editandoSalaDe" acima
    // troca sozinho (mesmo truque do upload de imagem).
    const criarEAbrirEdicao = async (dados: { nome: string; qtdBaias: number; equipes: string[]; entreSalas?: { salaIds: number[]; nomeRodizio: string } }) => {
      const novoId = await onCriarSala({ nome: dados.nome, qtdBaias: dados.qtdBaias, equipes: dados.equipes })
      if (!novoId) return false
      if (dados.entreSalas) {
        const okGrupo = await onCriarGrupoRodizio({
          nome: dados.entreSalas.nomeRodizio,
          salaIds: [novoId, ...dados.entreSalas.salaIds],
          equipes: dados.equipes,
        })
        if (!okGrupo) return false
      }
      const equipesDaSala = dados.equipes.length > 0 ? dados.equipes : (minhaEquipe ? [minhaEquipe] : [])
      setCriandoSala(false)
      setEditandoSalaDe({
        id: novoId,
        nome: dados.nome,
        imagem: null,
        imagemHash: null,
        qtdBaias: dados.qtdBaias,
        equipes: equipesDaSala,
        modoReserva: dados.entreSalas ? 'entre_salas' : (equipesDaSala.length > 1 ? 'equipe' : 'perfil'),
        podeEditar: true,
        baias: {},
        posicoes: {},
        marcadores: [],
        grupoRodizio: null,
      })
      return true
    }
    return (
      <CriarSala
        minhaEquipe={minhaEquipe}
        salas={salas}
        onCriar={criarEAbrirEdicao}
        onClose={() => setCriandoSala(false)}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🏢 Salas</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">Escolha o espaço que quer configurar.</p>

          <div className="config-baias-lista">
            {salasVisiveis.length === 0 && !podeConfigurarLaboratorio && (
              <p className="campo-nota">Nenhum espaço disponível pra sua equipe ainda.</p>
            )}
            {salasVisiveis.map(sala => (
              <div key={sala.id} className="painel-salas-linha">
                <button
                  type="button"
                  className="painel-salas-item"
                  title="Ver o que já está configurado"
                  onClick={() => setAbrindo({ tipo: 'visualizar', id: sala.id })}
                >
                  <span>🏢 {sala.nome}</span>
                  <span className="painel-salas-item-sub">{sala.equipes.map(labelEquipe).join(', ')}</span>
                </button>
                {(souAdmin || (minhaEquipe != null && sala.equipes.includes(minhaEquipe))) && (
                  <button
                    type="button"
                    className="painel-salas-equipes-btn"
                    title="Configurar sala"
                    onClick={() => setEditandoSalaDe(sala)}
                  >
                    ⚙️
                  </button>
                )}
              </div>
            ))}
            {podeConfigurarLaboratorio && (
              <button type="button" className="painel-salas-item" onClick={() => setAbrindo({ tipo: 'laboratorio' })}>
                <span>🧪 Laboratório</span>
                <span className="painel-salas-item-sub">{labelEquipe('suporte')} · Responsável fixo + backup</span>
              </button>
            )}
          </div>

          <button type="button" className="btn-secondary" style={{ marginTop: 14 }} onClick={() => setCriandoSala(true)}>
            ➕ Nova Sala
          </button>
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

type ModoCriacao = 'unica' | 'compartilhada' | 'entre_salas'

// Cria uma sala nova — cada equipe pode ter um layout diferente (quantidade
// de baias própria). Todo gestor (não só admin) escolhe o formato logo de
// cara: Única (1 equipe), Compartilhada (2+ equipes, mesma sala) ou Entre
// Salas (2+ equipes revezando entre essa sala nova e uma ou mais já
// existentes) — só precisa incluir a própria equipe entre as escolhidas
// quando o formato envolve mais equipes (mexer só em equipes alheias
// continua sendo coisa de admin).
function CriarSala({ minhaEquipe, salas, onCriar, onClose }: {
  minhaEquipe: string | null | undefined
  salas: Sala[]
  onCriar: (dados: { nome: string; qtdBaias: number; equipes: string[]; entreSalas?: { salaIds: number[]; nomeRodizio: string } }) => Resultado
  onClose: () => void
}) {
  const [modo, setModo] = useState<ModoCriacao>('unica')
  const [nome, setNome] = useState('')
  const [qtdBaias, setQtdBaias] = useState<number | string>(9)
  const [equipeUnica, setEquipeUnica] = useState(minhaEquipe || '')
  const [equipes, setEquipes] = useState<string[]>(minhaEquipe ? [minhaEquipe] : [])
  const [salasParaAgrupar, setSalasParaAgrupar] = useState<number[]>([])
  const [nomeRodizio, setNomeRodizio] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  // Clicar fora da caixa não pode simplesmente descartar um formulário que
  // já tem coisa preenchida — mesmo cuidado que as outras telas de sala já
  // têm ao fechar com algo pendente.
  const preenchido = Boolean(nome.trim() || qtdBaias !== 9 || modo !== 'unica' || salasParaAgrupar.length > 0 || nomeRodizio.trim())
  const tentarFechar = () => {
    if (salvando) return
    if (preenchido) {
      setConfirmandoSaida(true)
      return
    }
    onClose()
  }

  const alternarEquipe = (slug: string) => {
    setEquipes(prev => prev.includes(slug) ? prev.filter(e => e !== slug) : [...prev, slug])
  }

  const alternarSalaParaAgrupar = (id: number) => {
    setSalasParaAgrupar(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  // Salas com mapa de posições fixas só suportam 1 equipe (não entram em
  // rodízio entre salas); as que já fazem parte de outro grupo também não.
  const salasElegiveisParaAgrupar = salas.filter(s => s.imagem !== IMAGEM_COM_POSICOES_CONHECIDAS && !s.grupoRodizio)

  const criar = async () => {
    if (!nome.trim()) {
      alert('Dê um nome pra sala.')
      return
    }
    if (modo === 'unica') {
      if (!equipeUnica) {
        alert('Escolha a equipe dessa sala.')
        return
      }
    } else if (modo === 'compartilhada') {
      if (equipes.length < 2) {
        alert('Escolha pelo menos 2 equipes.')
        return
      }
    } else {
      // entre_salas: pode ser só 1 equipe se revezando entre 2+ salas dela
      // mesma (ex: Suporte com duas salas físicas), ou 2+ equipes também.
      if (equipes.length === 0) {
        alert('Escolha pelo menos uma equipe.')
        return
      }
      if (salasParaAgrupar.length === 0) {
        alert('Escolha pelo menos 1 sala já existente pra revezar com essa.')
        return
      }
      if (!nomeRodizio.trim()) {
        alert('Dê um nome pro rodízio entre salas.')
        return
      }
    }

    setSalvando(true)
    try {
      const equipesEscolhidas = modo === 'unica' ? [equipeUnica] : equipes
      const ok = await onCriar({
        nome: nome.trim(),
        qtdBaias: Number(qtdBaias),
        equipes: equipesEscolhidas,
        ...(modo === 'entre_salas' ? { entreSalas: { salaIds: salasParaAgrupar, nomeRodizio: nomeRodizio.trim() } } : {}),
      })
      if (ok) onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={tentarFechar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ Nova Sala</h3>
          <button className="modal-close" onClick={tentarFechar}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <div className="form-group">
            <label>Formato</label>
            <div className="auto-chip-row">
              <button type="button" className={`auto-chip ${modo === 'unica' ? 'ativo' : ''}`} onClick={() => setModo('unica')} disabled={salvando}>
                Sala Única
              </button>
              <button type="button" className={`auto-chip ${modo === 'compartilhada' ? 'ativo' : ''}`} onClick={() => setModo('compartilhada')} disabled={salvando}>
                Sala Compartilhada
              </button>
              <button type="button" className={`auto-chip ${modo === 'entre_salas' ? 'ativo' : ''}`} onClick={() => setModo('entre_salas')} disabled={salvando}>
                Entre Salas
              </button>
            </div>
            <small className="auto-campo-ajuda">
              {modo === 'unica' && 'Uma equipe só usa essa sala — o rodízio dela fica só aqui dentro.'}
              {modo === 'compartilhada' && '2 ou mais equipes dividem as baias dessa mesma sala.'}
              {modo === 'entre_salas' && 'Uma ou mais equipes se revezam entre essa sala nova e uma ou mais salas já existentes (dá pra ser a mesma equipe, revezando entre duas salas físicas dela mesma).'}
            </small>
          </div>

          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Nome da sala</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} placeholder="Ex: Sala Sistemas" />
          </div>

          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Quantidade de baias</label>
            <input type="number" min="1" max="50" value={qtdBaias} onChange={(e) => setQtdBaias(e.target.value)} disabled={salvando} />
          </div>

          {modo === 'unica' && (
            <>
              <p className="config-baias-explicacao" style={{ marginTop: 15 }}>Escolha a equipe dessa sala.</p>
              <div className="config-baias-lista">
                {EQUIPES.map(eq => (
                  <label key={eq.id} className="campo-toggle">
                    <input
                      type="radio"
                      name="equipe-unica-nova-sala"
                      checked={equipeUnica === eq.id}
                      disabled={salvando}
                      onChange={() => setEquipeUnica(eq.id)}
                    />
                    <span>{eq.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {modo !== 'unica' && (
            <>
              <p className="config-baias-explicacao" style={{ marginTop: 15 }}>
                Escolha quais equipes vão usar essa sala (a sua precisa estar entre elas).
              </p>
              <div className="config-baias-lista">
                {EQUIPES.map(eq => (
                  <label key={eq.id} className="campo-toggle">
                    <span className="toggle-switch">
                      <input type="checkbox" checked={equipes.includes(eq.id)} disabled={salvando} onChange={() => alternarEquipe(eq.id)} />
                      <span className="toggle-switch-slider"></span>
                    </span>
                    <span>{eq.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {modo === 'entre_salas' && (
            <>
              <div className="form-group" style={{ marginTop: 15 }}>
                <label>Nome do rodízio entre salas</label>
                <input type="text" value={nomeRodizio} onChange={(e) => setNomeRodizio(e.target.value)} disabled={salvando} placeholder="Ex: Rodízio Infra/Sistemas" />
              </div>

              <p className="config-baias-explicacao" style={{ marginTop: 15 }}>Escolha com qual(is) sala(s) já existente(s) essa sala nova vai revezar.</p>
              <div className="config-baias-lista">
                {salasElegiveisParaAgrupar.length === 0 && (
                  <p className="campo-nota">Nenhuma sala existente disponível pra agrupar (crie mais uma sala primeiro, sem mapa de posições fixas).</p>
                )}
                {salasElegiveisParaAgrupar.map(s => (
                  <label key={s.id} className="campo-toggle">
                    <span className="toggle-switch">
                      <input type="checkbox" checked={salasParaAgrupar.includes(s.id)} disabled={salvando} onChange={() => alternarSalaParaAgrupar(s.id)} />
                      <span className="toggle-switch-slider"></span>
                    </span>
                    <span>{s.nome}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={tentarFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={criar} disabled={salvando}>
            {salvando ? 'Criando...' : '➕ Criar'}
          </button>
        </div>

        {confirmandoSaida && (
          <div className="confirm-overlay" onClick={() => setConfirmandoSaida(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Sair sem criar?</h4>
              <p>Você já preencheu algo desse formulário. Se sair agora, essas informações serão perdidas.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-secondary" onClick={() => setConfirmandoSaida(false)}>
                  Continuar editando
                </button>
                <button type="button" className="btn-deletar" onClick={onClose}>
                  Sair sem criar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

