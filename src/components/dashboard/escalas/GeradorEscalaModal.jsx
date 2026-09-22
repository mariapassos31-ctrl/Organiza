'use client'

import { useState, useEffect } from 'react'
import { EQUIPES } from '../../../lib/equipesConfig'
import {
  DURACAO_PRESETS,
  HORIZONTE_PRESETS,
  PERCENTUAL_PRESETS,
  DIAS_SEMANA,
  tiposGeracaoDisponiveis,
  addDiasStr,
  diffDiasStr,
} from '../../../lib/escalasConstants'

const PASSOS = [
  { n: 1, label: 'Tipo' },
  { n: 2, label: 'Técnicos' },
  { n: 3, label: 'Regras' },
  { n: 4, label: 'Confirmar' },
]

// Só é montado enquanto o modal está aberto (o pai renderiza condicionalmente),
// então cada abertura é um mount novo — todo o estado abaixo já nasce
// resetado para a equipe/usuário atual, sem precisar de um efeito de reset.
export default function GeradorEscalaModal({ userData, usuarios, onClose, onAtualizarEscalas }) {
  // Sábado nunca escala Analista nem Aprendiz — os demais tipos usam a
  // lista normal (elegibilidade fina de home office fica a cargo do backend).
  const carregarTecnicosAtivosEquipe = (equipe, tipo = autoForm.tipo) => {
    const base = usuarios.filter(u => u.equipe === equipe && u.role !== 'admin' && u.role !== 'gestor' && u.baia !== '0' && u.ativo)
    return tipo === 'sabado' ? base.filter(u => u.role !== 'analista' && !u.ehAprendiz) : base
  }

  const equipeInicial = userData?.role === 'gestor' ? userData.equipe : 'suporte'

  const [passoAtual, setPassoAtual] = useState(1)
  const [autoForm, setAutoForm] = useState({
    equipe: equipeInicial,
    tipo: 'hibrido',
    dataInicio: '',
    dataFim: '',
    diasPorTecnico: 7,
    semFim: false,
    horizonteDias: 365,
  })
  const [autoTecnicosSelecionados, setAutoTecnicosSelecionados] = useState(
    carregarTecnicosAtivosEquipe(equipeInicial).map(t => t.uid)
  )
  const [autoDiasTrabalho, setAutoDiasTrabalho] = useState([1, 2, 3, 4, 5])
  const [autoPercentualHome, setAutoPercentualHome] = useState(50)
  // Suporte tem a regra de "sempre exatamente N pessoas" — já começa no modo
  // certo pra equipe, em vez de deixar porcentagem como padrão universal.
  const [autoModoHome, setAutoModoHome] = useState(equipeInicial === 'suporte' ? 'quantidade' : 'percentual')
  const [autoQuantidadeHome, setAutoQuantidadeHome] = useState(2)
  // Suporte troca a dupla de home office a cada 3 dias úteis (fica lá o
  // bloco inteiro); outras equipes, por padrão, escolhem de novo todo dia.
  const [autoDuracaoBlocoHome, setAutoDuracaoBlocoHome] = useState(equipeInicial === 'suporte' ? 3 : 1)
  const [autoPreviewBlocos, setAutoPreviewBlocos] = useState([])
  const [autoPreviewAvisos, setAutoPreviewAvisos] = useState([])
  const [autoPreviewErro, setAutoPreviewErro] = useState('')
  const [autoOverrides, setAutoOverrides] = useState({})
  const [autoRemovidos, setAutoRemovidos] = useState({})
  const [autoCarregandoPreview, setAutoCarregandoPreview] = useState(false)
  const [autoGerando, setAutoGerando] = useState(false)

  const mudarEquipeAuto = (novaEquipe) => {
    setAutoForm(prev => ({
      ...prev,
      equipe: novaEquipe,
      tipo: prev.tipo === 'sabado' && novaEquipe !== 'suporte' ? 'hibrido' : prev.tipo,
    }))
    setAutoTecnicosSelecionados(carregarTecnicosAtivosEquipe(novaEquipe).map(t => t.uid))
    setAutoModoHome(novaEquipe === 'suporte' ? 'quantidade' : 'percentual')
    setAutoDuracaoBlocoHome(novaEquipe === 'suporte' ? 3 : 1)
  }

  const mudarTipoAuto = (novoTipo) => {
    setAutoForm(prev => ({ ...prev, tipo: novoTipo, diasPorTecnico: novoTipo === 'sabado' ? 1 : 7 }))
    // Sábado tem elegibilidade mais restrita — tira da seleção quem deixou
    // de valer (ex: Analista/Aprendiz), pra não mandar escondido pro backend.
    const validos = new Set(carregarTecnicosAtivosEquipe(autoForm.equipe, novoTipo).map(t => t.uid))
    setAutoTecnicosSelecionados(prev => prev.filter(uid => validos.has(uid)))
  }

  const toggleTecnicoAuto = (uid) => {
    setAutoTecnicosSelecionados(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    )
  }

  const selecionarTodosTecnicosAuto = () => {
    setAutoTecnicosSelecionados(carregarTecnicosAtivosEquipe(autoForm.equipe).map(t => t.uid))
  }

  const toggleDiaTrabalho = (diaId) => {
    setAutoDiasTrabalho(prev =>
      prev.includes(diaId) ? prev.filter(d => d !== diaId) : [...prev, diaId]
    )
  }

  // Monta o payload de configuração sem alertar nada — usado pela prévia ao
  // vivo, que só dispara quando os campos já fazem sentido.
  const construirPayloadAuto = () => {
    if (!autoForm.dataInicio || autoTecnicosSelecionados.length === 0) return null

    let dataFimEfetiva = autoForm.dataFim
    if (autoForm.semFim) {
      const horizonte = Number(autoForm.horizonteDias)
      if (!Number.isInteger(horizonte) || horizonte < 1) return null
      dataFimEfetiva = addDiasStr(autoForm.dataInicio, horizonte - 1)
    } else {
      if (!autoForm.dataFim || autoForm.dataFim < autoForm.dataInicio) return null
    }

    if (autoForm.tipo === 'hibrido') {
      if (autoDiasTrabalho.length === 0) return null
      return {
        tipo: 'hibrido',
        equipe: autoForm.equipe,
        dataInicio: autoForm.dataInicio,
        dataFim: dataFimEfetiva,
        tecnicoUids: autoTecnicosSelecionados,
        diasTrabalho: autoDiasTrabalho,
        ...(autoModoHome === 'quantidade'
          ? { quantidadeHomeOffice: Number(autoQuantidadeHome), duracaoBlocoDiasHomeOffice: Number(autoDuracaoBlocoHome) }
          : { percentualHomeOffice: Number(autoPercentualHome) }),
      }
    }

    return {
      tipo: autoForm.tipo,
      equipe: autoForm.equipe,
      dataInicio: autoForm.dataInicio,
      dataFim: dataFimEfetiva,
      diasPorTecnico: Number(autoForm.diasPorTecnico),
      tecnicoUids: autoTecnicosSelecionados,
    }
  }

  // Prévia ao vivo: recalcula sozinha (com um pequeno atraso) toda vez que
  // a configuração muda, sem precisar de um botão "Pré-visualizar". Fica
  // sempre ativa (mesmo em passos anteriores) pra já estar pronta quando o
  // usuário chegar no passo de confirmação.
  useEffect(() => {
    const payload = construirPayloadAuto()
    if (!payload) {
      setAutoPreviewBlocos([])
      setAutoPreviewErro('')
      return
    }
    const handle = setTimeout(async () => {
      setAutoCarregandoPreview(true)
      try {
        const response = await fetch('/api/escalas/auto/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          setAutoPreviewBlocos([])
          setAutoPreviewAvisos([])
          setAutoPreviewErro(data.error || 'Não foi possível calcular a prévia')
        } else {
          setAutoPreviewBlocos(data.blocos)
          setAutoPreviewAvisos(data.avisos || [])
          setAutoPreviewErro('')
          setAutoOverrides({})
          setAutoRemovidos({})
        }
      } catch {
        setAutoPreviewErro('Não foi possível calcular a prévia')
      } finally {
        setAutoCarregandoPreview(false)
      }
    }, 500)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoForm, autoTecnicosSelecionados, autoDiasTrabalho, autoPercentualHome, autoModoHome, autoQuantidadeHome, autoDuracaoBlocoHome])

  const nomeTecnicoAuto = (uid) => carregarTecnicosAtivosEquipe(autoForm.equipe).find(t => t.uid === uid)?.nome || '?'

  const blocosEfetivosAuto = autoPreviewBlocos
    .map((b, i) => ({
      ...b,
      tecnicoUid: autoOverrides[i] || b.tecnicoUid,
      tecnicoNome: autoOverrides[i] ? nomeTecnicoAuto(autoOverrides[i]) : b.tecnicoNome,
    }))
    .filter((_, i) => !autoRemovidos[i])

  const resumoPorTecnicoAuto = {}
  for (const b of blocosEfetivosAuto) {
    const dias = diffDiasStr(b.dataInicio, b.dataFim)
    if (!resumoPorTecnicoAuto[b.tecnicoNome]) resumoPorTecnicoAuto[b.tecnicoNome] = {}
    resumoPorTecnicoAuto[b.tecnicoNome][b.tipo] = (resumoPorTecnicoAuto[b.tecnicoNome][b.tipo] || 0) + dias
  }

  const confirmarGeracaoAuto = async () => {
    if (blocosEfetivosAuto.length === 0) return
    setAutoGerando(true)
    try {
      const response = await fetch('/api/escalas/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipe: autoForm.equipe,
          blocosManuais: blocosEfetivosAuto.map(b => ({
            dataInicio: b.dataInicio,
            dataFim: b.dataFim,
            tecnicoUid: b.tecnicoUid,
            tipo: b.tipo,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao gerar escalas')
      }
      await onAtualizarEscalas()
      onClose()
      alert(`${data.criadas} escala(s) gerada(s) com sucesso!`)
    } catch (error) {
      alert(error.message)
    } finally {
      setAutoGerando(false)
    }
  }

  // Validação de cada passo — controla se dá pra avançar e destrava os
  // avisos de campo faltando.
  const passo2Valido = autoTecnicosSelecionados.length > 0
  const passo3Valido = (() => {
    if (!autoForm.dataInicio) return false
    if (autoForm.semFim) {
      const horizonte = Number(autoForm.horizonteDias)
      if (!Number.isInteger(horizonte) || horizonte < 1) return false
    } else {
      if (!autoForm.dataFim || autoForm.dataFim < autoForm.dataInicio) return false
    }
    if (autoForm.tipo === 'hibrido' && autoDiasTrabalho.length === 0) return false
    return true
  })()

  const irParaPassoAnterior = () => setPassoAtual(p => Math.max(1, p - 1))
  const irParaProximoPasso = () => setPassoAtual(p => Math.min(4, p + 1))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auto-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🪄 Nova Escala</h3>
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

        <div className="auto-form">
          {/* PASSO 1 — TIPO E EQUIPE */}
          {passoAtual === 1 && (
            <>
              {userData?.role === 'admin' && (
                <div className="auto-secao">
                  <label className="auto-secao-titulo">Equipe</label>
                  <div className="auto-chip-row">
                    {EQUIPES.map(eq => (
                      <button
                        type="button"
                        key={eq.id}
                        className={`auto-chip ${autoForm.equipe === eq.id ? 'ativo' : ''}`}
                        onClick={() => mudarEquipeAuto(eq.id)}
                      >
                        {eq.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="auto-secao">
                <label className="auto-secao-titulo">O que você quer escalar?</label>
                <div className="auto-chip-row">
                  {tiposGeracaoDisponiveis(autoForm.equipe).map(tipo => (
                    <button
                      type="button"
                      key={tipo.id}
                      className={`auto-chip ${autoForm.tipo === tipo.id ? 'ativo' : ''}`}
                      style={autoForm.tipo === tipo.id ? { background: tipo.cor, borderColor: tipo.cor } : {}}
                      onClick={() => mudarTipoAuto(tipo.id)}
                    >
                      {tipo.label}
                    </button>
                  ))}
                </div>
                {autoForm.tipo === 'hibrido' && (
                  <small className="auto-campo-ajuda">
                    Todo dia, a equipe é dividida entre Presencial e Home Office na proporção definida, revezando quem fica em cada grupo — ao final de um ciclo completo, todo mundo teve a mesma quantidade de dias de cada tipo.
                  </small>
                )}
              </div>
            </>
          )}

          {/* PASSO 2 — TÉCNICOS */}
          {passoAtual === 2 && (
            <div className="auto-secao">
              <div className="auto-secao-header">
                <label className="auto-secao-titulo">Técnicos participantes</label>
                <button type="button" className="auto-link" onClick={selecionarTodosTecnicosAuto}>
                  Selecionar todos
                </button>
              </div>
              <div className="auto-chip-row">
                {carregarTecnicosAtivosEquipe(autoForm.equipe).length === 0 ? (
                  <p className="empty-state">Nenhum técnico ativo nessa equipe</p>
                ) : (
                  carregarTecnicosAtivosEquipe(autoForm.equipe).map(tecnico => (
                    <button
                      type="button"
                      key={tecnico.uid}
                      className={`auto-chip auto-chip-tecnico ${autoTecnicosSelecionados.includes(tecnico.uid) ? 'ativo' : ''}`}
                      onClick={() => toggleTecnicoAuto(tecnico.uid)}
                    >
                      {autoTecnicosSelecionados.includes(tecnico.uid) ? '✓ ' : ''}{tecnico.nome}
                    </button>
                  ))
                )}
              </div>
              {!passo2Valido && (
                <small className="auto-campo-alerta">Selecione ao menos um técnico pra continuar.</small>
              )}
            </div>
          )}

          {/* PASSO 3 — REGRAS E PERÍODO */}
          {passoAtual === 3 && (
            <>
              {autoForm.tipo === 'hibrido' && (
                <>
                  <div className="auto-secao">
                    <label className="auto-secao-titulo">Dias de trabalho</label>
                    <div className="auto-chip-row">
                      {DIAS_SEMANA.map(dia => (
                        <button
                          type="button"
                          key={dia.id}
                          className={`auto-chip ${autoDiasTrabalho.includes(dia.id) ? 'ativo' : ''}`}
                          onClick={() => toggleDiaTrabalho(dia.id)}
                        >
                          {dia.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="auto-secao">
                    <label className="auto-secao-titulo">Como decidir quem fica em Home Office</label>
                    <div className="auto-chip-row">
                      <button
                        type="button"
                        className={`auto-chip ${autoModoHome === 'percentual' ? 'ativo' : ''}`}
                        onClick={() => setAutoModoHome('percentual')}
                      >
                        Porcentagem
                      </button>
                      <button
                        type="button"
                        className={`auto-chip ${autoModoHome === 'quantidade' ? 'ativo' : ''}`}
                        onClick={() => setAutoModoHome('quantidade')}
                      >
                        Quantidade fixa por dia
                      </button>
                    </div>

                    {autoModoHome === 'percentual' ? (
                      <>
                        <div className="auto-chip-row">
                          {PERCENTUAL_PRESETS.map(p => (
                            <button
                              type="button"
                              key={p}
                              className={`auto-chip ${autoPercentualHome === p ? 'ativo' : ''}`}
                              onClick={() => setAutoPercentualHome(p)}
                            >
                              {p}%
                            </button>
                          ))}
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={autoPercentualHome}
                            onChange={(e) => setAutoPercentualHome(e.target.value)}
                            className="auto-dias-input"
                            title="Porcentagem personalizada"
                          />
                        </div>
                        {autoTecnicosSelecionados.length > 0 && (
                          <small className="auto-campo-ajuda">
                            Todo dia de trabalho, {Math.round((autoTecnicosSelecionados.length * Number(autoPercentualHome || 0)) / 100)} de {autoTecnicosSelecionados.length} técnico(s) ficam em home office; os demais ficam presencial.
                          </small>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="auto-chip-row">
                          <input
                            type="number"
                            min="1"
                            value={autoQuantidadeHome}
                            onChange={(e) => setAutoQuantidadeHome(e.target.value)}
                            className="auto-dias-input"
                            title="Quantidade de pessoas em home office por dia"
                          />
                        </div>
                        <small className="auto-campo-ajuda">
                          Todo dia de trabalho, exatamente {autoQuantidadeHome} pessoa(s) ficam em home office. O sistema nunca escala especialidade Aprendiz/Supervisor, nunca repete especialidade nem coloca 2 pessoas que entram às 07:00 juntas no mesmo dia, e evita colocar a mesma dupla de baia junta.
                        </small>

                        <label className="auto-secao-titulo" style={{ marginTop: 14 }}>A cada quantos dias trocar a dupla</label>
                        <div className="auto-chip-row">
                          <input
                            type="number"
                            min="1"
                            value={autoDuracaoBlocoHome}
                            onChange={(e) => setAutoDuracaoBlocoHome(e.target.value)}
                            className="auto-dias-input"
                            title="Dias seguidos que a mesma dupla fica em home office"
                          />
                        </div>
                        <small className="auto-campo-ajuda">
                          {Number(autoDuracaoBlocoHome) === 1
                            ? 'A dupla é escolhida de novo todo dia (pode repetir ou trocar).'
                            : `A mesma dupla fica em home office por ${autoDuracaoBlocoHome} dias úteis seguidos antes de passar a vez pra próxima.`}
                        </small>
                      </>
                    )}
                  </div>
                </>
              )}

              {autoForm.tipo !== 'hibrido' && autoTecnicosSelecionados.length > 1 && (
                <div className="auto-secao">
                  <label className="auto-secao-titulo">
                    {autoForm.tipo === 'sabado' ? 'Sábados seguidos por técnico' : 'Duração do turno de cada técnico'}
                  </label>
                  <div className="auto-chip-row">
                    {(autoForm.tipo === 'sabado' ? DURACAO_PRESETS.sabado : DURACAO_PRESETS.padrao).map(p => (
                      <button
                        type="button"
                        key={p.value}
                        className={`auto-chip ${Number(autoForm.diasPorTecnico) === p.value ? 'ativo' : ''}`}
                        onClick={() => setAutoForm({ ...autoForm, diasPorTecnico: p.value })}
                      >
                        {p.label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      value={autoForm.diasPorTecnico}
                      onChange={(e) => setAutoForm({ ...autoForm, diasPorTecnico: e.target.value })}
                      className="auto-dias-input"
                      title="Valor personalizado"
                    />
                  </div>
                  {autoForm.tipo === 'sabado' && (
                    <small className="auto-campo-ajuda">Só os sábados do período viram escala; os demais dias são ignorados.</small>
                  )}
                </div>
              )}
              {autoForm.tipo !== 'hibrido' && autoTecnicosSelecionados.length === 1 && autoForm.tipo === 'sabado' && (
                <p className="auto-explicacao">Só 1 técnico selecionado: todos os sábados do período ficam com ele(a).</p>
              )}
              {autoForm.tipo !== 'hibrido' && autoTecnicosSelecionados.length === 1 && autoForm.tipo !== 'sabado' && (
                <p className="auto-explicacao">Só 1 técnico selecionado: o período inteiro fica com ele(a), numa única escala.</p>
              )}

              <div className="auto-secao">
                <label className="auto-secao-titulo">Data de início</label>
                <input
                  type="date"
                  value={autoForm.dataInicio}
                  onChange={(e) => setAutoForm({ ...autoForm, dataInicio: e.target.value })}
                  className="auto-date-input"
                />
              </div>

              <div className="auto-secao">
                <label className="auto-secao-titulo">Até quando gerar</label>
                <div className="auto-chip-row">
                  <button
                    type="button"
                    className={`auto-chip ${!autoForm.semFim ? 'ativo' : ''}`}
                    onClick={() => setAutoForm({ ...autoForm, semFim: false })}
                  >
                    Data de fim definida
                  </button>
                  <button
                    type="button"
                    className={`auto-chip ${autoForm.semFim ? 'ativo' : ''}`}
                    onClick={() => setAutoForm({ ...autoForm, semFim: true })}
                  >
                    Sem data de fim
                  </button>
                </div>
                {autoForm.semFim ? (
                  <>
                    <div className="auto-chip-row">
                      {HORIZONTE_PRESETS.map(p => (
                        <button
                          type="button"
                          key={p.value}
                          className={`auto-chip ${Number(autoForm.horizonteDias) === p.value ? 'ativo' : ''}`}
                          onClick={() => setAutoForm({ ...autoForm, horizonteDias: p.value })}
                        >
                          {p.label}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        value={autoForm.horizonteDias}
                        onChange={(e) => setAutoForm({ ...autoForm, horizonteDias: e.target.value })}
                        className="auto-dias-input"
                        title="Dias personalizados"
                      />
                    </div>
                    <small className="auto-campo-ajuda">
                      Gera escalas até essa data à frente. Quando estiver acabando, gere de novo a partir dali para continuar.
                    </small>
                  </>
                ) : (
                  <input
                    type="date"
                    value={autoForm.dataFim}
                    onChange={(e) => setAutoForm({ ...autoForm, dataFim: e.target.value })}
                    className="auto-date-input"
                  />
                )}
              </div>
              {!passo3Valido && (
                <small className="auto-campo-alerta">Preencha a data de início e o período pra continuar.</small>
              )}
            </>
          )}

          {/* PASSO 4 — PRÉVIA E CONFIRMAÇÃO */}
          {passoAtual === 4 && (
            <div className="auto-secao auto-preview-secao">
              <label className="auto-secao-titulo">
                Prévia {autoCarregandoPreview && <span className="auto-preview-carregando">atualizando...</span>}
              </label>

              {autoPreviewErro && <p className="auto-preview-erro">⚠️ {autoPreviewErro}</p>}

              {!autoPreviewErro && blocosEfetivosAuto.length === 0 && (
                <p className="empty-state">Preencha os campos anteriores para ver a prévia.</p>
              )}

              {autoPreviewAvisos.length > 0 && (
                <div className="auto-preview-avisos">
                  {autoPreviewAvisos.map((aviso, i) => (
                    <p key={i} className="auto-preview-aviso">
                      ⚠️ {new Date(aviso.data + 'T00:00:00').toLocaleDateString('pt-BR')}: {aviso.mensagem}
                    </p>
                  ))}
                </div>
              )}

              {blocosEfetivosAuto.length > 0 && (
                <>
                  <p className="auto-explicacao">
                    {blocosEfetivosAuto.length} escala(s) serão criadas. Dá pra trocar o técnico de cada uma ou remover antes de confirmar.
                  </p>

                  <div className="auto-resumo-tabela">
                    {Object.entries(resumoPorTecnicoAuto).map(([nome, contagem]) => (
                      <div key={nome} className="auto-resumo-linha">
                        <span className="auto-resumo-nome">{nome}</span>
                        {Object.entries(contagem).map(([tipoId, dias]) => (
                          <span key={tipoId} className="auto-resumo-valor">
                            {tipoId === 'presencial' ? '🏢' : tipoId === 'homeoffice' ? '🏠' : tipoId === 'sabado' ? '📅' : '🚨'} {dias}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="auto-preview-lista">
                    {autoPreviewBlocos.map((b, i) => {
                      if (autoRemovidos[i]) return null
                      const tecnicoAtualUid = autoOverrides[i] || b.tecnicoUid
                      return (
                        <div key={i} className="auto-preview-item">
                          <span className="auto-preview-tipo">
                            {b.tipo === 'presencial' ? '🏢' : b.tipo === 'homeoffice' ? '🏠' : b.tipo === 'sabado' ? '📅' : '🚨'}
                          </span>
                          <span className="auto-preview-periodo">
                            {new Date(b.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                            {b.dataInicio !== b.dataFim && ` a ${new Date(b.dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                          </span>
                          <span className="auto-preview-seta">→</span>
                          <select
                            className="auto-preview-tecnico-select"
                            value={tecnicoAtualUid}
                            onChange={(e) => setAutoOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                          >
                            {carregarTecnicosAtivosEquipe(autoForm.equipe).map(t => (
                              <option key={t.uid} value={t.uid}>{t.nome}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="auto-preview-remover"
                            title="Remover esta escala"
                            onClick={() => setAutoRemovidos(prev => ({ ...prev, [i]: true }))}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="form-actions-modal">
            {passoAtual > 1 && (
              <button type="button" className="btn-secondary" onClick={irParaPassoAnterior}>
                ← Voltar
              </button>
            )}
            {passoAtual < 4 && (
              <button
                type="button"
                className="btn-success"
                disabled={(passoAtual === 2 && !passo2Valido) || (passoAtual === 3 && !passo3Valido)}
                onClick={irParaProximoPasso}
              >
                Próximo →
              </button>
            )}
            {passoAtual === 4 && (
              <button type="button" className="btn-success" disabled={autoGerando || blocosEfetivosAuto.length === 0} onClick={confirmarGeracaoAuto}>
                {autoGerando
                  ? 'Gerando...'
                  : blocosEfetivosAuto.length > 0
                  ? `✅ Gerar ${blocosEfetivosAuto.length} Escala(s)`
                  : '✅ Gerar Escalas'}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
