'use client'

import { useState, type ComponentProps } from 'react'
import type { Sala } from '../../../types/dominio'
import ConfigSala from './ConfigSala'
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
type DadosBaia = { equipe?: string | null; especialidade?: string | null; perfil?: string | null }
type Aberto = { tipo: "sala"; id: number } | { tipo: "laboratorio" } | null

interface PainelSalasProps {
  salas: Sala[]
  podeConfigurarLaboratorio: boolean
  laboratorioProps: Omit<ComponentProps<typeof ConfigLaboratorio>, "onClose">
  minhaEquipe: string | null | undefined
  souAdmin: boolean
  onAlterarBaiaSala: (salaId: number, baia: string, valores: DadosBaia) => Resultado
  onAlterarEquipesSala: (salaId: number, equipes: string[]) => Resultado
  onCriarSala: (dados: { nome: string; qtdBaias: number; equipes: string[] }) => Resultado
  onEditarSala: (salaId: number, dados: { nome: string; qtdBaias: number }) => Resultado
  onExcluirSala: (salaId: number) => Resultado
  onEnviarImagemSala: (salaId: number, arquivo: File) => unknown
  onRemoverImagemSala: (salaId: number) => unknown
  onClose: () => void
}

export default function PainelSalas({ salas, podeConfigurarLaboratorio, laboratorioProps, minhaEquipe, souAdmin, onAlterarBaiaSala, onAlterarEquipesSala, onCriarSala, onEditarSala, onExcluirSala, onEnviarImagemSala, onRemoverImagemSala, onClose }: PainelSalasProps) {
  const [abrindo, setAbrindo] = useState<Aberto>(null)
  const [editandoSalaDe, setEditandoSalaDe] = useState<Sala | null>(null)
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
        onClose={() => setEditandoSalaDe(null)}
      />
    )
  }

  if (criandoSala) {
    return (
      <CriarSala
        souAdmin={souAdmin}
        onCriar={onCriarSala}
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

// Cria uma sala nova — cada equipe pode ter um layout diferente (quantidade
// de baias própria). Gestor/Líder já cria vinculada à própria equipe;
// admin escolhe quais equipes.
function CriarSala({ souAdmin, onCriar, onClose }: {
  souAdmin: boolean
  onCriar: (dados: { nome: string; qtdBaias: number; equipes: string[] }) => Resultado
  onClose: () => void
}) {
  const [nome, setNome] = useState('')
  const [qtdBaias, setQtdBaias] = useState<number | string>(9)
  const [equipes, setEquipes] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)

  const alternarEquipe = (slug: string) => {
    setEquipes(prev => prev.includes(slug) ? prev.filter(e => e !== slug) : [...prev, slug])
  }

  const criar = async () => {
    if (!nome.trim()) {
      alert('Dê um nome pra sala.')
      return
    }
    if (souAdmin && equipes.length === 0) {
      alert('Escolha pelo menos uma equipe.')
      return
    }
    setSalvando(true)
    try {
      const ok = await onCriar({ nome: nome.trim(), qtdBaias: Number(qtdBaias), equipes })
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
            <label>Nome da sala</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} disabled={salvando} placeholder="Ex: Sala Sistemas" />
          </div>

          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Quantidade de baias</label>
            <input type="number" min="1" max="50" value={qtdBaias} onChange={(e) => setQtdBaias(e.target.value)} disabled={salvando} />
          </div>

          {souAdmin ? (
            <>
              <p className="config-baias-explicacao" style={{ marginTop: 15 }}>Escolha quais equipes vão usar essa sala.</p>
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
          ) : (
            <p className="campo-nota" style={{ marginTop: 15 }}>Essa sala já nasce vinculada à sua equipe.</p>
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
function EditarSala({ sala, onSalvarDetalhes, onSalvarEquipes, onExcluir, onEnviarImagem, onRemoverImagem, onClose }: {
  sala: Sala
  onSalvarDetalhes: PainelSalasProps["onEditarSala"]
  onSalvarEquipes: PainelSalasProps["onAlterarEquipesSala"]
  onExcluir: PainelSalasProps["onExcluirSala"]
  onEnviarImagem: PainelSalasProps["onEnviarImagemSala"]
  onRemoverImagem: PainelSalasProps["onRemoverImagemSala"]
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
              <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={removerImagem} disabled={enviandoImagem}>
                {enviandoImagem ? 'Removendo...' : '🗑️ Remover imagem'}
              </button>
            )}
            <p className="campo-nota">Só vira mapa visual se as posições de cada baia nessa imagem já tiverem sido configuradas — pra uma imagem nova, me avise que eu configuro isso.</p>
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
