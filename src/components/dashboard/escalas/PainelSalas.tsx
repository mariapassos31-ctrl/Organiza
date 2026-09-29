'use client'

import { useState, type ComponentProps } from 'react'
import type { GrupoRodizioDetalhado, MarcadorSala, PosicaoBaia, Sala } from '../../../types/dominio'
import ConfigLaboratorio from './ConfigLaboratorio'
import SalaWizard, { type ModoWizard } from './SalaWizard'
import { EQUIPES, labelEquipe } from '../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'

// Painel único de espaços físicos — lista as salas (e o Laboratório) que
// a pessoa pode configurar, deixa criar uma sala nova (cada equipe tem seu
// próprio layout) e abre a tela certa pra cada um. Cada sala já decide
// sozinha (na API) se é mapa visual ou lista, e se a reserva é por perfil
// ou por equipe — quem já é da sala controla isso mudando a lista de
// equipes vinculadas (botão ⚙️, que abre o SalaWizard).
type Resultado = Promise<boolean> | boolean
type ResultadoId = Promise<number | false> | number | false
type DadosBaia = { equipe?: string | null; especialidade?: string | null; perfil?: string | null }
type Aberto = { tipo: "laboratorio" } | { tipo: "rodizio" } | null

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
  const [salaWizard, setSalaWizard] = useState<ModoWizard | null>(null)

  const salasVisiveis = salas.filter(s => s.podeEditar)

  if (salaWizard) {
    return (
      <SalaWizard
        modoInicial={salaWizard}
        salas={salas}
        minhaEquipe={minhaEquipe}
        souAdmin={souAdmin}
        onAlterarBaiaSala={onAlterarBaiaSala}
        onAlterarEquipesSala={onAlterarEquipesSala}
        onCriarSala={onCriarSala}
        onEditarSala={onEditarSala}
        onExcluirSala={onExcluirSala}
        onEnviarImagemSala={onEnviarImagemSala}
        onRemoverImagemSala={onRemoverImagemSala}
        onAjustarPosicoesSala={onAjustarPosicoesSala}
        onAjustarMarcadoresSala={onAjustarMarcadoresSala}
        onCriarGrupoRodizio={onCriarGrupoRodizio}
        onClose={() => setSalaWizard(null)}
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
                <span className="painel-salas-item painel-salas-item-rotulo">
                  <span>🏢 {sala.nome}</span>
                  <span className="painel-salas-item-sub">{sala.equipes.map(labelEquipe).join(', ')}</span>
                </span>
                {(souAdmin || (minhaEquipe != null && sala.equipes.includes(minhaEquipe))) && (
                  <button
                    type="button"
                    className="painel-salas-equipes-btn"
                    title="Configurar sala"
                    onClick={() => setSalaWizard({ modo: 'editar', id: sala.id })}
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

          <button type="button" className="btn-secondary" style={{ marginTop: 14 }} onClick={() => setSalaWizard({ modo: 'criar' })}>
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
