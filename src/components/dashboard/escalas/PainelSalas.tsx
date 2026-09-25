'use client'

import { useState, type ComponentProps } from 'react'
import type { GrupoRodizioDetalhado, MarcadorSala, PosicaoBaia, Sala } from '../../../types/dominio'
import ConfigSala from './ConfigSala'
import ConfigLaboratorio from './ConfigLaboratorio'
import EditorPosicoesSala from './EditorPosicoesSala'
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
type Aberto = { tipo: "sala"; id: number } | { tipo: "laboratorio" } | { tipo: "rodizio" } | null

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
  grupos: GrupoRodizioDetalhado[]
  onCriarGrupoRodizio: (dados: { nome: string; salaIds: number[]; equipes: string[] }) => Resultado
  onEditarGrupoRodizio: (grupoId: number, dados: { nome?: string; salaIds?: number[]; equipes?: string[] }) => Resultado
  onExcluirGrupoRodizio: (grupoId: number) => Resultado
  onGerarRodizioEntreSalas: (grupoId: number, periodo: { dataInicio: string; dataFim: string }) => Resultado
  onClose: () => void
}

export default function PainelSalas({ salas, podeConfigurarLaboratorio, laboratorioProps, minhaEquipe, souAdmin, onAlterarBaiaSala, onAlterarEquipesSala, onCriarSala, onEditarSala, onExcluirSala, onEnviarImagemSala, onRemoverImagemSala, onAjustarPosicoesSala, onAjustarMarcadoresSala, grupos, onCriarGrupoRodizio, onEditarGrupoRodizio, onExcluirGrupoRodizio, onGerarRodizioEntreSalas, onClose }: PainelSalasProps) {
  const [abrindo, setAbrindo] = useState<Aberto>(null)
  const [editandoSalaDe, setEditandoSalaDe] = useState<Sala | null>(null)
  const [ajustandoPosicoesDe, setAjustandoPosicoesDe] = useState<number | null>(null)
  const [criandoSala, setCriandoSala] = useState(false)

  const salasVisiveis = salas.filter(s => s.podeEditar)

  if (abrindo?.tipo === 'sala') {
    const sala = salas.find(s => s.id === abrindo.id)
    if (!sala) return null
    return (
      <ConfigSala
        sala={sala}
        minhaEquipe={minhaEquipe}
        souAdmin={souAdmin}
        onAlterarBaia={(baia, valores) => onAlterarBaiaSala(sala.id, baia, valores)}
        onClose={() => setAbrindo(null)}
      />
    )
  }

  if (abrindo?.tipo === 'laboratorio') {
    return <ConfigLaboratorio {...laboratorioProps} onClose={() => setAbrindo(null)} />
  }

  if (abrindo?.tipo === 'rodizio') {
    return (
      <PainelRodizioEntreSalas
        salas={salas}
        grupos={grupos}
        onCriar={onCriarGrupoRodizio}
        onEditar={onEditarGrupoRodizio}
        onExcluir={onExcluirGrupoRodizio}
        onGerar={onGerarRodizioEntreSalas}
        onClose={() => setAbrindo(null)}
      />
    )
  }

  if (ajustandoPosicoesDe != null) {
    const sala = salas.find(s => s.id === ajustandoPosicoesDe)
    if (!sala) return null
    return (
      <EditorPosicoesSala
        sala={sala}
        todasAsSalas={salas}
        onSalvarPosicoes={(posicoes) => onAjustarPosicoesSala(sala.id, posicoes)}
        onSalvarMarcadores={(marcadores) => onAjustarMarcadoresSala(sala.id, marcadores)}
        onClose={() => setAjustandoPosicoesDe(null)}
      />
    )
  }

  if (editandoSalaDe) {
    // Deriva da lista viva de salas (não do snapshot que abriu a tela) —
    // assim, depois de um upload de imagem, o preview atualiza sozinho.
    const salaAtual = salas.find(s => s.id === editandoSalaDe.id) || editandoSalaDe
    return (
      <EditarSala
        sala={salaAtual}
        onSalvarDetalhes={onEditarSala}
        onSalvarEquipes={onAlterarEquipesSala}
        onExcluir={onExcluirSala}
        onEnviarImagem={onEnviarImagemSala}
        onRemoverImagem={onRemoverImagemSala}
        onAjustarPosicoes={() => setAjustandoPosicoesDe(salaAtual.id)}
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
                  onClick={() => setAbrindo({ tipo: 'sala', id: sala.id })}
                >
                  <span>🏢 {sala.nome}</span>
                  <span className="painel-salas-item-sub">{sala.equipes.map(labelEquipe).join(', ')}</span>
                </button>
                {(souAdmin || (minhaEquipe != null && sala.equipes.includes(minhaEquipe))) && (
                  <button
                    type="button"
                    className="painel-salas-equipes-btn"
                    title="Editar sala"
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
            <button type="button" className="painel-salas-item" onClick={() => setAbrindo({ tipo: 'rodizio' })}>
              <span>🔀 Rodízio entre salas</span>
              <span className="painel-salas-item-sub">{grupos.length} configurado(s)</span>
            </button>
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ Nova Sala</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
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
          <button type="button" className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={criar} disabled={salvando}>
            {salvando ? 'Criando...' : '➕ Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Edita nome, quantidade de baias, imagem e as equipes de uma sala — e
// deixa excluir ela. Sala com 1 equipe reserva por perfil; com 2+, por
// equipe — muda sozinho, só de olhar a lista marcada aqui embaixo.
function EditarSala({ sala, onSalvarDetalhes, onSalvarEquipes, onExcluir, onEnviarImagem, onRemoverImagem, onAjustarPosicoes, onClose }: {
  sala: Sala
  onSalvarDetalhes: PainelSalasProps["onEditarSala"]
  onSalvarEquipes: PainelSalasProps["onAlterarEquipesSala"]
  onExcluir: PainelSalasProps["onExcluirSala"]
  onEnviarImagem: PainelSalasProps["onEnviarImagemSala"]
  onRemoverImagem: PainelSalasProps["onRemoverImagemSala"]
  onAjustarPosicoes: () => void
  onClose: () => void
}) {
  const [nome, setNome] = useState(sala.nome)
  const [qtdBaias, setQtdBaias] = useState<number | string>(sala.qtdBaias)
  const [equipes, setEquipes] = useState<string[]>(sala.equipes)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [enviandoImagem, setEnviandoImagem] = useState(false)

  // Essa imagem já tem posições de baia fixas, feitas pra 1 equipe só
  // (perfis específicos dela, tipo Estag/Aprendiz e Supervisor). Deixar
  // 2+ equipes aqui viraria "reserva por equipe" e quebraria tudo isso —
  // por isso a seleção fica travada em uma equipe só (como rádio).
  const imagemFixa = sala.imagem === IMAGEM_COM_POSICOES_CONHECIDAS
  const numerosBaia = Array.from({ length: sala.qtdBaias || 9 }, (_, i) => String(i + 1))
  const posicoesCompletas = !imagemFixa && !!sala.imagem && numerosBaia.every(n => sala.posicoes?.[n])

  const alternarEquipe = (slug: string) => {
    if (imagemFixa) {
      setEquipes([slug])
      return
    }
    setEquipes(prev => prev.includes(slug) ? prev.filter(e => e !== slug) : [...prev, slug])
  }

  const salvar = async () => {
    if (!nome.trim()) {
      alert('Dê um nome pra sala.')
      return
    }
    if (equipes.length === 0) {
      alert('Escolha pelo menos uma equipe.')
      return
    }
    setSalvando(true)
    try {
      const okDetalhes = await onSalvarDetalhes(sala.id, { nome: nome.trim(), qtdBaias: Number(qtdBaias) })
      const equipesMudaram = JSON.stringify([...equipes].sort()) !== JSON.stringify([...sala.equipes].sort())
      const okEquipes = equipesMudaram ? await onSalvarEquipes(sala.id, equipes) : true
      if (okDetalhes && okEquipes) onClose()
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    setSalvando(true)
    try {
      const ok = await onExcluir(sala.id)
      if (ok) onClose()
    } finally {
      setSalvando(false)
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙️ Editar "{sala.nome}"</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <div className="form-group">
            <label>Nome da sala</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} />
          </div>

          {sala.imagem === IMAGEM_COM_POSICOES_CONHECIDAS ? (
            <p className="campo-nota" style={{ marginTop: 15 }}>
              Essa sala usa um mapa com posições fixas (baias 0 a 9) — a quantidade de baias não se aplica aqui.
            </p>
          ) : (
            <div className="form-group" style={{ marginTop: 15 }}>
              <label>Quantidade de baias</label>
              <input type="number" min="1" max="50" value={qtdBaias} onChange={(e) => setQtdBaias(e.target.value)} disabled={salvando} />
            </div>
          )}

          <div className="form-group" style={{ marginTop: 15 }}>
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
                  <button type="button" className="btn-secondary" onClick={onAjustarPosicoes} disabled={enviandoImagem}>
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
                    disabled={salvando}
                    onChange={() => alternarEquipe(eq.id)}
                  />
                ) : (
                  <span className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={equipes.includes(eq.id)}
                      disabled={salvando}
                      onChange={() => alternarEquipe(eq.id)}
                    />
                    <span className="toggle-switch-slider"></span>
                  </span>
                )}
                <span>{eq.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-deletar" onClick={() => setConfirmandoExclusao(true)} disabled={salvando}>
            🗑️ Excluir sala
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '💾 Salvar'}
          </button>
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
      </div>
    </div>
  )
}

// "Entre Salas": lista os rodízios já configurados (2+ salas onde as
// equipes escolhidas se revezam de verdade entre os ambientes) e deixa
// criar um novo. Só admin mexe aqui — envolve tirar salas de outros
// vínculos e sincronizar as equipes de várias salas de uma vez.
function PainelRodizioEntreSalas({ salas, grupos, onCriar, onEditar, onExcluir, onGerar, onClose }: {
  salas: Sala[]
  grupos: GrupoRodizioDetalhado[]
  onCriar: PainelSalasProps["onCriarGrupoRodizio"]
  onEditar: PainelSalasProps["onEditarGrupoRodizio"]
  onExcluir: PainelSalasProps["onExcluirGrupoRodizio"]
  onGerar: PainelSalasProps["onGerarRodizioEntreSalas"]
  onClose: () => void
}) {
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [gerandoId, setGerandoId] = useState<number | null>(null)

  if (criando) {
    return (
      <FormGrupoRodizio
        salas={salas}
        onSalvar={onCriar}
        onClose={() => setCriando(false)}
      />
    )
  }

  if (editandoId != null) {
    const grupo = grupos.find(g => g.id === editandoId)
    if (!grupo) return null
    return (
      <FormGrupoRodizio
        salas={salas}
        grupoExistente={grupo}
        onSalvar={(dados) => onEditar(grupo.id, dados)}
        onExcluir={() => onExcluir(grupo.id)}
        onClose={() => setEditandoId(null)}
      />
    )
  }

  if (gerandoId != null) {
    const grupo = grupos.find(g => g.id === gerandoId)
    if (!grupo) return null
    return (
      <FormGerarRodizio
        grupo={grupo}
        onGerar={(periodo) => onGerar(grupo.id, periodo)}
        onClose={() => setGerandoId(null)}
      />
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔀 Rodízio entre salas</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">
            Um grupo de 2 ou mais salas onde as pessoas das equipes escolhidas se revezam de verdade entre os ambientes — muda quem senta em qual sala com o tempo, não é uma divisão fixa.
          </p>

          <div className="config-baias-lista">
            {grupos.length === 0 && <p className="campo-nota">Nenhum rodízio entre salas criado ainda.</p>}
            {grupos.map(g => (
              <div key={g.id} className="painel-salas-linha">
                <button type="button" className="painel-salas-item" onClick={() => setEditandoId(g.id)}>
                  <span>🔀 {g.nome}</span>
                  <span className="painel-salas-item-sub">{g.salas.map(s => s.nome).join(' + ')} · {g.equipes.map(labelEquipe).join(', ')}</span>
                </button>
                <button type="button" className="painel-salas-equipes-btn" title="Gerar rodízio" onClick={() => setGerandoId(g.id)}>
                  🔄
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="btn-secondary" style={{ marginTop: 14 }} onClick={() => setCriando(true)}>
            ➕ Novo rodízio entre salas
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

// Cria ou edita um grupo — nome, quais salas entram (excluindo a que tem
// mapa fixo, que só suporta 1 equipe) e quais equipes se revezam entre
// elas. Salvar sincroniza as equipes de TODAS as salas do grupo, senão
// elas desalinhariam (uma sala com equipe que a outra não tem).
function FormGrupoRodizio({ salas, grupoExistente, onSalvar, onExcluir, onClose }: {
  salas: Sala[]
  grupoExistente?: GrupoRodizioDetalhado
  onSalvar: (dados: { nome: string; salaIds: number[]; equipes: string[] }) => Resultado
  onExcluir?: () => Resultado
  onClose: () => void
}) {
  const [nome, setNome] = useState(grupoExistente?.nome || '')
  const [salaIds, setSalaIds] = useState<number[]>(grupoExistente?.salas.map(s => s.id) || [])
  const [equipes, setEquipes] = useState<string[]>(grupoExistente?.equipes || [])
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  const salasElegiveis = salas.filter(s =>
    s.imagem !== IMAGEM_COM_POSICOES_CONHECIDAS &&
    (!s.grupoRodizio || s.grupoRodizio.id === grupoExistente?.id)
  )

  const alternarSala = (id: number) => {
    setSalaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }
  const alternarEquipe = (slug: string) => {
    setEquipes(prev => prev.includes(slug) ? prev.filter(e => e !== slug) : [...prev, slug])
  }

  const salvar = async () => {
    if (!nome.trim()) {
      alert('Dê um nome pro rodízio.')
      return
    }
    if (salaIds.length < 2) {
      alert('Escolha pelo menos 2 salas.')
      return
    }
    if (equipes.length === 0) {
      alert('Escolha pelo menos uma equipe.')
      return
    }
    setSalvando(true)
    try {
      const ok = await onSalvar({ nome: nome.trim(), salaIds, equipes })
      if (ok) onClose()
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    setSalvando(true)
    try {
      const ok = await onExcluir?.()
      if (ok) onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{grupoExistente ? `⚙️ Editar "${grupoExistente.nome}"` : '➕ Novo rodízio entre salas'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <div className="form-group">
            <label>Nome do rodízio</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              placeholder="Ex: Rodízio Infra/Sistemas/Projetos"
            />
          </div>

          <p className="config-baias-explicacao" style={{ marginTop: 15 }}>
            Escolha pelo menos 2 salas (sem mapa de posições fixas) que vão fazer parte do rodízio.
          </p>
          <div className="config-baias-lista">
            {salasElegiveis.map(s => (
              <label key={s.id} className="campo-toggle">
                <span className="toggle-switch">
                  <input type="checkbox" checked={salaIds.includes(s.id)} disabled={salvando} onChange={() => alternarSala(s.id)} />
                  <span className="toggle-switch-slider"></span>
                </span>
                <span>{s.nome}</span>
              </label>
            ))}
            {salasElegiveis.length < 2 && (
              <p className="campo-nota">Não há salas suficientes disponíveis — crie mais uma sala primeiro, ou tire uma sala de outro rodízio.</p>
            )}
          </div>

          <p className="config-baias-explicacao" style={{ marginTop: 15 }}>
            Escolha quais equipes vão se revezar entre essas salas — vira a lista de equipes de todas elas (pode ser uma equipe só, revezando entre duas salas dela mesma).
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
        </div>

        <div className="form-actions-modal">
          {grupoExistente && (
            <button type="button" className="btn-deletar" onClick={() => setConfirmandoExclusao(true)} disabled={salvando}>
              🗑️ Desfazer rodízio
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>

        {confirmandoExclusao && (
          <div className="confirm-overlay" onClick={() => setConfirmandoExclusao(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Desfazer "{grupoExistente?.nome}"?</h4>
              <p>As salas voltam a ser independentes (mantêm as equipes que já tinham). Escalas já geradas mantêm a sala que ficou gravada nelas, como histórico.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-secondary" onClick={() => setConfirmandoExclusao(false)}>
                  Cancelar
                </button>
                <button type="button" className="btn-deletar" onClick={excluir}>
                  Desfazer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Aplica o rodízio num período: decide, pra cada escala presencial ainda
// sem sala nesse período, qual sala do grupo a pessoa ocupa — só mexe em
// quem ainda não tem sala definida, então rodar de novo não bagunça quem
// já foi decidido antes.
function FormGerarRodizio({ grupo, onGerar, onClose }: {
  grupo: GrupoRodizioDetalhado
  onGerar: (periodo: { dataInicio: string; dataFim: string }) => Resultado
  onClose: () => void
}) {
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [gerando, setGerando] = useState(false)

  const gerar = async () => {
    if (!dataInicio || !dataFim) {
      alert('Escolha o período.')
      return
    }
    if (dataFim < dataInicio) {
      alert('A data final não pode ser antes da data inicial.')
      return
    }
    setGerando(true)
    try {
      const ok = await onGerar({ dataInicio, dataFim })
      if (ok) onClose()
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔄 Gerar rodízio — {grupo.nome}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">
            Pra cada escala presencial já cadastrada nesse período (das equipes {grupo.equipes.map(labelEquipe).join(', ')}) que ainda não tem sala definida, decide qual das salas do grupo ({grupo.salas.map(s => s.nome).join(', ')}) a pessoa ocupa — sempre priorizando quem tem menos dias acumulados em cada uma, pra ser um rodízio justo de verdade, não só uma divisão única.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>De</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} disabled={gerando} />
            </div>
            <div className="form-group">
              <label>Até</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} disabled={gerando} />
            </div>
          </div>
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={gerando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={gerar} disabled={gerando}>
            {gerando ? 'Gerando...' : '🔄 Gerar'}
          </button>
        </div>
      </div>
    </div>
  )
}
