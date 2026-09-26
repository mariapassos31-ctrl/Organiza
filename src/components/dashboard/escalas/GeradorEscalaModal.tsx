'use client'

import { useState, useEffect } from 'react'
import { useNotificacao } from '../../../context/NotificacaoContext'
import { mensagemDeErro } from '../../../lib/erros'
import type { Sala, Usuario, UsuarioLogado } from '../../../types/dominio'
import { EQUIPES, labelEquipe } from '../../../lib/equipesConfig'
import {
  DURACAO_PRESETS,
  HORIZONTE_PRESETS,
  PERCENTUAL_PRESETS,
  DIAS_SEMANA,
  tiposGeracaoDisponiveis,
  addDiasStr,
  diffDiasStr,
} from '../../../lib/escalasConstants'

interface AutoForm {
  tipo: string
  dataInicio: string
  dataFim: string
  diasPorTecnico: number | string
  semFim: boolean
  horizonteDias: number | string
}

interface BlocoPreview {
  dataInicio: string
  dataFim: string
  tecnicoUid: string
  tecnicoNome: string
  tipo: string
}

interface AvisoPreview {
  data: string
  mensagem: string
}

// Presencial, home office e sábado são "onde a pessoa está fisicamente" —
// nunca podem coexistir pro mesmo técnico no mesmo dia (mesma regra do
// backend em escalasAuto.ts).
const TIPOS_PRESENCA_FISICA = new Set(['presencial', 'homeoffice', 'sabado'])

const PASSOS = [
  { n: 1, label: 'Tipo' },
  { n: 2, label: 'Técnicos' },
  { n: 3, label: 'Regras' },
  { n: 4, label: 'Confirmar' },
]

// Só é montado enquanto o modal está aberto (o pai renderiza condicionalmente),
// então cada abertura é um mount novo — todo o estado abaixo já nasce
// resetado para a equipe/usuário atual, sem precisar de um efeito de reset.
export default function GeradorEscalaModal({ userData, usuarios, salas, onClose, onAtualizarEscalas }: {
  userData: UsuarioLogado | null
  usuarios: Usuario[]
  salas: Sala[]
  onClose: () => void
  onAtualizarEscalas: () => Promise<void> | void
}) {
  // Quem não é admin só pode gerar pra uma sala que a própria equipe usa;
  // admin pode escolher qualquer sala cadastrada.
  const salasSelecionaveis = userData?.role === 'admin'
    ? salas
    : salas.filter(s => userData?.equipe && s.equipes.includes(userData.equipe))

  // Sábado nunca escala Analista, Líder nem Aprendiz — os demais tipos usam
  // a lista normal (elegibilidade fina de home office fica a cargo do backend).
  // Os técnicos elegíveis são os de TODAS as equipes que usam a sala — se
  // ela for compartilhada por 2+ equipes, a geração já mistura todo mundo.
  const carregarTecnicosPorEquipes = (equipesSlugs: string[], tipo: string = autoForm.tipo) => {
    const base = usuarios.filter(u => equipesSlugs.includes(u.equipe ?? '') && u.role !== 'admin' && u.role !== 'gestor' && u.baia !== '0' && u.ativo)
    return tipo === 'sabado' ? base.filter(u => u.role !== 'analista' && u.role !== 'lider' && !u.ehAprendiz) : base
  }
  const carregarTecnicosDaSala = (sala: Sala | null | undefined, tipo: string = autoForm.tipo) =>
    carregarTecnicosPorEquipes(sala?.equipes ?? [], tipo)

  // Prioriza a sala exclusiva do Suporte como padrão (é o caso mais comum);
  // senão, a primeira sala que a pessoa pode escolher.
  const salaInicialId = salasSelecionaveis.find(s => s.equipes.length === 1 && s.equipes[0] === 'suporte')?.id
    ?? salasSelecionaveis[0]?.id
    ?? ''
  const salaInicial = salasSelecionaveis.find(s => s.id === salaInicialId) || null
  const ehSuporteExclusivo = (sala: Sala | null) => Boolean(sala && sala.equipes.length === 1 && sala.equipes[0] === 'suporte')

  // Sábado ocupa lugar de verdade (a pessoa senta numa baia), então
  // precisa de uma sala — mas hoje só existe UMA equipe que pode ter
  // escala de sábado (Suporte, e só numa sala exclusiva dela; o backend
  // recusa qualquer outra combinação). Como a resposta já é sempre a
  // mesma, não faz sentido perguntar "qual sala" — só "qual equipe" (que,
  // na prática, tem uma opção só), e a sala é resolvida sozinha.
  const salaExclusivaDaEquipe = (equipeSlug: string) =>
    salasSelecionaveis.find(s => s.equipes.length === 1 && s.equipes[0] === equipeSlug) || null
  const equipesParaSabado = EQUIPES.filter(eq => eq.id === 'suporte' && salaExclusivaDaEquipe(eq.id))

  // Sala com 2+ equipes: o que importa é quantas baias ela tem pra
  // presencial (isso já está montado na configuração da sala) — não faz
  // sentido perguntar "quantos ficam em home", porque casa lotada de gente
  // em home é o normal ali. O resto (quem não coube na sala) que fica em
  // home office, automaticamente.
  const ehSalaCompartilhada = (sala: Sala | null) => Boolean(sala && sala.equipes.length > 1)
  // Sugere a capacidade presencial de acordo com o que já está cadastrado
  // na própria sala (a quantidade de baias reais) — não inventa um número
  // menor só pra sempre sobrar alguém de home office; se a sala cabe todo
  // mundo, o aviso abaixo do campo já explica que precisa reduzir pra
  // sobrar quem revezar.
  const capacidadePresencialDaSala = (sala: Sala | null) => {
    if (!sala) return 1
    const baiasReservadas = Object.keys(sala.baias).length
    return baiasReservadas > 0 ? baiasReservadas : (sala.qtdBaias || 1)
  }

  const { notificar } = useNotificacao()
  const [passoAtual, setPassoAtual] = useState(1)
  const [autoSalaId, setAutoSalaId] = useState<number | string>(salaInicialId)
  const [autoForm, setAutoForm] = useState<AutoForm>({
    tipo: 'hibrido',
    dataInicio: '',
    dataFim: '',
    diasPorTecnico: 7,
    semFim: false,
    horizonteDias: 365,
  })
  const [autoTecnicosSelecionados, setAutoTecnicosSelecionados] = useState(
    carregarTecnicosDaSala(salaInicial).map(t => t.uid)
  )
  // Sobreaviso não ocupa lugar físico nenhum — em vez de escolher uma
  // sala (que só serviria aqui pra apontar a equipe), escolhe a equipe
  // direto. Não-admin já começa na própria equipe; admin escolhe.
  const equipesSelecionaveisSobreaviso = userData?.role === 'admin' ? EQUIPES : EQUIPES.filter(eq => eq.id === userData?.equipe)
  const [autoEquipeSobreaviso, setAutoEquipeSobreaviso] = useState<string>(
    userData?.role === 'admin' ? '' : (userData?.equipe || '')
  )
  const [autoDiasTrabalho, setAutoDiasTrabalho] = useState([1, 2, 3, 4, 5])
  const [autoPercentualHome, setAutoPercentualHome] = useState<number | string>(50)
  // Suporte tem a regra de "sempre exatamente N pessoas" — já começa no modo
  // certo pra sala, em vez de deixar porcentagem como padrão universal.
  const [autoModoHome, setAutoModoHome] = useState(ehSuporteExclusivo(salaInicial) ? 'quantidade' : 'percentual')
  const [autoQuantidadeHome, setAutoQuantidadeHome] = useState<number | string>(2)
  // Só usado quando a sala é compartilhada (2+ equipes) — quantidade de
  // baias presenciais, já sugerida a partir da própria configuração da
  // sala; o home office é sempre "o resto" e nunca perguntado.
  const [autoQuantidadePresencial, setAutoQuantidadePresencial] = useState<number | string>(
    capacidadePresencialDaSala(salaInicial)
  )
  // Suporte troca a dupla de home office a cada 3 dias úteis (fica lá o
  // bloco inteiro); outras salas, por padrão, escolhem de novo todo dia.
  const [autoDuracaoBlocoHome, setAutoDuracaoBlocoHome] = useState<number | string>(ehSuporteExclusivo(salaInicial) ? 3 : 1)
  const [autoRespeitarEspecialidade, setAutoRespeitarEspecialidade] = useState(true)
  const [autoPreviewBlocos, setAutoPreviewBlocos] = useState<BlocoPreview[]>([])
  const [autoPreviewAvisos, setAutoPreviewAvisos] = useState<AvisoPreview[]>([])
  const [autoPreviewErro, setAutoPreviewErro] = useState('')
  const [autoOverrides, setAutoOverrides] = useState<Record<number, string>>({})
  const [autoRemovidos, setAutoRemovidos] = useState<Record<number, boolean>>({})
  const [autoCarregandoPreview, setAutoCarregandoPreview] = useState(false)
  const [autoGerando, setAutoGerando] = useState(false)

  const salaSelecionada = salas.find(s => s.id === Number(autoSalaId)) || null

  const mudarSalaAuto = (novoSalaId: number) => {
    const novaSala = salas.find(s => s.id === novoSalaId) || null
    setAutoSalaId(novoSalaId)
    setAutoForm(prev => ({
      ...prev,
      tipo: prev.tipo === 'sabado' && !ehSuporteExclusivo(novaSala) ? 'hibrido' : prev.tipo,
    }))
    const tecnicosDaNovaSala = carregarTecnicosDaSala(novaSala).map(t => t.uid)
    setAutoTecnicosSelecionados(tecnicosDaNovaSala)
    setAutoModoHome(ehSuporteExclusivo(novaSala) ? 'quantidade' : 'percentual')
    setAutoDuracaoBlocoHome(ehSuporteExclusivo(novaSala) ? 3 : 1)
    setAutoQuantidadePresencial(capacidadePresencialDaSala(novaSala))
  }

  const ehSobreaviso = autoForm.tipo === 'sobreaviso'
  const ehSabado = autoForm.tipo === 'sabado'
  // Fonte dos técnicos elegíveis do passo atual — de uma sala (a maioria
  // dos tipos) ou direto da equipe escolhida (Sobreaviso, e agora Sábado
  // também — só que pra Sábado a "equipe" já resolve pra uma sala fixa
  // por baixo dos panos, porque ali a pessoa senta de verdade).
  const tecnicosDisponiveisAuto = (tipo: string = autoForm.tipo) =>
    tipo === 'sobreaviso'
      ? carregarTecnicosPorEquipes(autoEquipeSobreaviso ? [autoEquipeSobreaviso] : [], tipo)
      : carregarTecnicosDaSala(salaSelecionada, tipo)

  const mudarEquipeSobreaviso = (slug: string) => {
    setAutoEquipeSobreaviso(slug)
    setAutoTecnicosSelecionados(carregarTecnicosPorEquipes([slug]).map(t => t.uid))
  }

  // Escolher a equipe do Sábado só decide a sala por baixo dos panos (ela
  // já é única pra cada equipe elegível) — dali em diante segue igual a
  // qualquer sala escolhida (mesmos técnicos, mesmo payload).
  const mudarEquipeSabado = (slug: string) => {
    const sala = salaExclusivaDaEquipe(slug)
    if (!sala) return
    setAutoSalaId(sala.id)
    setAutoTecnicosSelecionados(carregarTecnicosDaSala(sala, 'sabado').map(t => t.uid))
  }

  const mudarTipoAuto = (novoTipo: string) => {
    setAutoForm(prev => ({ ...prev, tipo: novoTipo, diasPorTecnico: novoTipo === 'sabado' ? 1 : 7 }))
    // Ao entrar em Sábado, já resolve a equipe (e a sala dela) sozinho —
    // hoje só existe uma opção válida, não faz sentido deixar em branco
    // esperando um clique que só tem uma resposta possível.
    if (novoTipo === 'sabado' && equipesParaSabado[0]) {
      mudarEquipeSabado(equipesParaSabado[0].id)
      return
    }
    // Sábado tem elegibilidade mais restrita — tira da seleção quem deixou
    // de valer (ex: Analista/Aprendiz), pra não mandar escondido pro backend.
    const validos = new Set(tecnicosDisponiveisAuto(novoTipo).map(t => t.uid))
    setAutoTecnicosSelecionados(prev => prev.filter(uid => validos.has(uid)))
  }

  const toggleTecnicoAuto = (uid: string) => {
    setAutoTecnicosSelecionados(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    )
  }

  const selecionarTodosTecnicosAuto = () => {
    setAutoTecnicosSelecionados(tecnicosDisponiveisAuto().map(t => t.uid))
  }

  const toggleDiaTrabalho = (diaId: number) => {
    setAutoDiasTrabalho(prev =>
      prev.includes(diaId) ? prev.filter(d => d !== diaId) : [...prev, diaId]
    )
  }

  // Monta o payload de configuração sem alertar nada — usado pela prévia ao
  // vivo, que só dispara quando os campos já fazem sentido.
  const construirPayloadAuto = () => {
    if ((ehSobreaviso ? !autoEquipeSobreaviso : !autoSalaId) || !autoForm.dataInicio || autoTecnicosSelecionados.length === 0) return null

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
      // Sala compartilhada: o que se define é quanta gente cabe presencial
      // (a sala já diz isso) — o home office é sempre o restante, calculado
      // aqui, nunca perguntado diretamente.
      const quantidadeHomeOfficeEfetiva = ehSalaCompartilhada(salaSelecionada)
        ? Math.max(0, autoTecnicosSelecionados.length - Number(autoQuantidadePresencial || 0))
        : Number(autoQuantidadeHome)
      if (ehSalaCompartilhada(salaSelecionada) && quantidadeHomeOfficeEfetiva < 1) return null
      return {
        tipo: 'hibrido',
        salaId: Number(autoSalaId),
        dataInicio: autoForm.dataInicio,
        dataFim: dataFimEfetiva,
        tecnicoUids: autoTecnicosSelecionados,
        diasTrabalho: autoDiasTrabalho,
        ...(ehSalaCompartilhada(salaSelecionada) || autoModoHome === 'quantidade'
          ? { quantidadeHomeOffice: quantidadeHomeOfficeEfetiva, duracaoBlocoDiasHomeOffice: Number(autoDuracaoBlocoHome), respeitarEspecialidade: autoRespeitarEspecialidade }
          : { percentualHomeOffice: Number(autoPercentualHome) }),
      }
    }

    return {
      tipo: autoForm.tipo,
      ...(ehSobreaviso ? { equipeSlugs: [autoEquipeSobreaviso] } : { salaId: Number(autoSalaId) }),
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
  }, [autoSalaId, autoEquipeSobreaviso, autoForm, autoTecnicosSelecionados, autoDiasTrabalho, autoPercentualHome, autoModoHome, autoQuantidadeHome, autoQuantidadePresencial, autoDuracaoBlocoHome, autoRespeitarEspecialidade])

  const nomeTecnicoAuto = (uid: string) => tecnicosDisponiveisAuto().find(t => t.uid === uid)?.nome || '?'

  const blocosEfetivosAuto = autoPreviewBlocos
    .map((b, i) => ({
      ...b,
      tecnicoUid: autoOverrides[i] || b.tecnicoUid,
      tecnicoNome: autoOverrides[i] ? nomeTecnicoAuto(autoOverrides[i]) : b.tecnicoNome,
      // Home office também guarda de qual sala ele veio (mesmo não ocupando
      // baia nenhuma) — sem isso, quando a equipe está em mais de uma sala,
      // o home office de quem foi escalado pela Sala Infra vazava pra
      // dentro da visão da Sala do Suporte também, só por ser da equipe
      // Suporte. Sobreaviso continua sem sala (não veio de nenhuma).
      salaId: b.tipo !== 'sobreaviso' && autoSalaId ? Number(autoSalaId) : null,
    }))
    .filter((_, i) => !autoRemovidos[i])

  const resumoPorTecnicoAuto: Record<string, Record<string, number>> = {}
  for (const b of blocosEfetivosAuto) {
    const dias = diffDiasStr(b.dataInicio, b.dataFim)
    if (!resumoPorTecnicoAuto[b.tecnicoNome]) resumoPorTecnicoAuto[b.tecnicoNome] = {}
    resumoPorTecnicoAuto[b.tecnicoNome][b.tipo] = (resumoPorTecnicoAuto[b.tecnicoNome][b.tipo] || 0) + dias
  }

  // Trocar o técnico de um bloco individual (linha abaixo) pode deixar
  // alguém com duas escalas físicas (presencial/home office/sábado) no
  // mesmo dia sem ninguém perceber — o backend recusa na hora de confirmar,
  // mas é bem melhor avisar já na prévia, com o item destacado, do que só
  // descobrir depois de tentar salvar.
  const indicesComConflitoAuto = new Set<number>()
  for (let i = 0; i < autoPreviewBlocos.length; i++) {
    if (autoRemovidos[i]) continue
    const a = autoPreviewBlocos[i]
    if (!TIPOS_PRESENCA_FISICA.has(a.tipo)) continue
    const tecnicoA = autoOverrides[i] || a.tecnicoUid
    for (let j = i + 1; j < autoPreviewBlocos.length; j++) {
      if (autoRemovidos[j]) continue
      const b = autoPreviewBlocos[j]
      if (!TIPOS_PRESENCA_FISICA.has(b.tipo)) continue
      const tecnicoB = autoOverrides[j] || b.tecnicoUid
      if (tecnicoA !== tecnicoB) continue
      if (a.dataInicio <= b.dataFim && b.dataInicio <= a.dataFim) {
        indicesComConflitoAuto.add(i)
        indicesComConflitoAuto.add(j)
      }
    }
  }

  const confirmarGeracaoAuto = async () => {
    if (blocosEfetivosAuto.length === 0 || indicesComConflitoAuto.size > 0) return
    setAutoGerando(true)
    try {
      const response = await fetch('/api/escalas/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(ehSobreaviso ? { equipeSlugs: [autoEquipeSobreaviso] } : { salaId: Number(autoSalaId) }),
          blocosManuais: blocosEfetivosAuto.map(b => ({
            dataInicio: b.dataInicio,
            dataFim: b.dataFim,
            tecnicoUid: b.tecnicoUid,
            tipo: b.tipo,
            salaId: b.salaId,
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao gerar escalas')
      }
      await onAtualizarEscalas()
      onClose()
      notificar(`${data.criadas} escala(s) gerada(s) com sucesso!`, { tipo: 'sucesso' })
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setAutoGerando(false)
    }
  }

  // Validação de cada passo — controla se dá pra avançar e destrava os
  // avisos de campo faltando.
  const passo1Valido = ehSobreaviso ? Boolean(autoEquipeSobreaviso) : Boolean(autoSalaId)
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
    if (autoForm.tipo === 'hibrido' && ehSalaCompartilhada(salaSelecionada)) {
      const home = autoTecnicosSelecionados.length - Number(autoQuantidadePresencial || 0)
      if (home < 1) return false
    }
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
          {/* PASSO 1 — TIPO E SALA */}
          {passoAtual === 1 && (
            <>
              <div className="auto-secao">
                <label className="auto-secao-titulo">O que você quer escalar?</label>
                <div className="auto-chip-row">
                  {tiposGeracaoDisponiveis(equipesParaSabado.length > 0).map(tipo => (
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
                    Todo dia, o grupo é dividido entre Presencial e Home Office na proporção definida, revezando quem fica em cada grupo — ao final de um ciclo completo, todo mundo teve a mesma quantidade de dias de cada tipo.
                  </small>
                )}
              </div>

              {ehSobreaviso ? (
                <div className="auto-secao">
                  <label className="auto-secao-titulo">Equipe</label>
                  <div className="auto-chip-row">
                    {equipesSelecionaveisSobreaviso.length === 0 ? (
                      <p className="empty-state">Nenhuma equipe disponível pra você gerar escala.</p>
                    ) : (
                      equipesSelecionaveisSobreaviso.map(eq => (
                        <button
                          type="button"
                          key={eq.id}
                          className={`auto-chip ${autoEquipeSobreaviso === eq.id ? 'ativo' : ''}`}
                          onClick={() => mudarEquipeSobreaviso(eq.id)}
                        >
                          {eq.label}
                        </button>
                      ))
                    )}
                  </div>
                  <small className="auto-campo-ajuda">
                    Sobreaviso não ocupa lugar físico — só precisa saber de qual equipe tirar quem fica de plantão.
                  </small>
                </div>
              ) : ehSabado ? (
                <div className="auto-secao">
                  <label className="auto-secao-titulo">Equipe</label>
                  <div className="auto-chip-row">
                    {equipesParaSabado.length === 0 ? (
                      <p className="empty-state">Nenhuma equipe com sala exclusiva disponível pra escala de sábado.</p>
                    ) : (
                      equipesParaSabado.map(eq => (
                        <button
                          type="button"
                          key={eq.id}
                          className={`auto-chip ${salaSelecionada?.equipes[0] === eq.id ? 'ativo' : ''}`}
                          onClick={() => mudarEquipeSabado(eq.id)}
                        >
                          {eq.label}
                        </button>
                      ))
                    )}
                  </div>
                  <small className="auto-campo-ajuda">
                    Sábado ocupa baia de verdade — a sala já é a exclusiva dessa equipe, não precisa escolher.
                  </small>
                </div>
              ) : (
                <div className="auto-secao">
                  <label className="auto-secao-titulo">Sala</label>
                  <div className="auto-chip-row">
                    {salasSelecionaveis.length === 0 ? (
                      <p className="empty-state">Nenhuma sala disponível pra você gerar escala.</p>
                    ) : (
                      salasSelecionaveis.map(s => (
                        <button
                          type="button"
                          key={s.id}
                          className={`auto-chip ${Number(autoSalaId) === s.id ? 'ativo' : ''}`}
                          onClick={() => mudarSalaAuto(s.id)}
                        >
                          🏢 {s.nome}
                        </button>
                      ))
                    )}
                  </div>
                  {salaSelecionada && salaSelecionada.equipes.length > 1 && (
                    <small className="auto-campo-ajuda">
                      Essa sala é usada por {salaSelecionada.equipes.map(labelEquipe).join(', ')} — a geração mistura técnicos de todas elas juntos.
                    </small>
                  )}
                </div>
              )}
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
                {tecnicosDisponiveisAuto().length === 0 ? (
                  <p className="empty-state">{ehSobreaviso ? 'Nenhum técnico ativo nessa equipe' : 'Nenhum técnico ativo nas equipes dessa sala'}</p>
                ) : (
                  tecnicosDisponiveisAuto().map(tecnico => (
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
                    {ehSalaCompartilhada(salaSelecionada) ? (
                      <>
                        <label className="auto-secao-titulo">Quantas pessoas ficam presenciais por dia</label>
                        <div className="auto-chip-row">
                          <input
                            type="number"
                            min="1"
                            value={autoQuantidadePresencial}
                            onChange={(e) => setAutoQuantidadePresencial(e.target.value)}
                            className="auto-dias-input"
                            title="Quantidade de pessoas presenciais por dia"
                          />
                        </div>
                        {(() => {
                          const presencial = Number(autoQuantidadePresencial) || 0
                          const home = autoTecnicosSelecionados.length - presencial
                          return home <= 0 ? (
                            <small className="auto-campo-alerta">
                              Isso não deixaria ninguém em home office — reduza a quantidade presencial (tem {autoTecnicosSelecionados.length} técnico(s) selecionado(s)).
                            </small>
                          ) : (
                            <small className="auto-campo-ajuda">
                              Todo dia de trabalho, exatamente {presencial} de {autoTecnicosSelecionados.length} técnico(s) ficam presenciais (a sala tem {capacidadePresencialDaSala(salaSelecionada)} baia(s) configurada(s)); os demais {home} ficam em home office.
                            </small>
                          )
                        })()}

                        <label className="campo-toggle" style={{ marginTop: 10 }}>
                          <span className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={autoRespeitarEspecialidade}
                              onChange={(e) => setAutoRespeitarEspecialidade(e.target.checked)}
                            />
                            <span className="toggle-switch-slider"></span>
                          </span>
                          <span>Nunca repetir especialidade no mesmo grupo de home office</span>
                        </label>

                        <label className="auto-secao-titulo" style={{ marginTop: 14 }}>A cada quantos dias trocar quem fica em Home Office</label>
                        <div className="auto-chip-row">
                          <input
                            type="number"
                            min="1"
                            value={autoDuracaoBlocoHome}
                            onChange={(e) => setAutoDuracaoBlocoHome(e.target.value)}
                            className="auto-dias-input"
                            title="Dias seguidos que o mesmo grupo fica em home office"
                          />
                        </div>
                        <small className="auto-campo-ajuda">
                          {Number(autoDuracaoBlocoHome) === 1
                            ? 'O grupo em home office é escolhido de novo todo dia (pode repetir ou trocar).'
                            : `O mesmo grupo fica em home office por ${autoDuracaoBlocoHome} dias úteis seguidos antes de passar a vez pro próximo.`}
                        </small>
                      </>
                    ) : (
                      <>
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
                          Todo dia de trabalho, exatamente {autoQuantidadeHome} pessoa(s) ficam em home office. O sistema nunca escala Estag/Aprendiz, Trainee ou Supervisor, nunca coloca 2 pessoas que entram às 07:00 juntas no mesmo dia, e evita colocar a mesma dupla de especialidade junta.
                        </small>

                        <label className="campo-toggle" style={{ marginTop: 10 }}>
                          <span className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={autoRespeitarEspecialidade}
                              onChange={(e) => setAutoRespeitarEspecialidade(e.target.checked)}
                            />
                            <span className="toggle-switch-slider"></span>
                          </span>
                          <span>Nunca repetir especialidade no mesmo grupo de home office</span>
                        </label>

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

                  {indicesComConflitoAuto.size > 0 && (
                    <p className="auto-preview-erro">
                      ⚠️ Tem gente com duas escalas físicas (presencial/home office/sábado) no mesmo dia depois das trocas feitas abaixo — ajuste os itens marcados antes de confirmar.
                    </p>
                  )}

                  <div className="auto-preview-lista">
                    {autoPreviewBlocos.map((b, i) => {
                      if (autoRemovidos[i]) return null
                      const tecnicoAtualUid = autoOverrides[i] || b.tecnicoUid
                      const emConflito = indicesComConflitoAuto.has(i)
                      return (
                        <div key={i} className={`auto-preview-item${emConflito ? ' auto-preview-item-conflito' : ''}`}>
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
                            {tecnicosDisponiveisAuto().map(t => (
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
                          {emConflito && (
                            <small className="auto-preview-item-conflito-aviso">
                              ⚠️ {b.tipo === 'presencial' ? '🏢' : b.tipo === 'homeoffice' ? '🏠' : '📅'} duplicado pra essa pessoa nesse período
                            </small>
                          )}
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
                disabled={(passoAtual === 1 && !passo1Valido) || (passoAtual === 2 && !passo2Valido) || (passoAtual === 3 && !passo3Valido)}
                onClick={irParaProximoPasso}
              >
                Próximo →
              </button>
            )}
            {passoAtual === 4 && (
              <button type="button" className="btn-success" disabled={autoGerando || blocosEfetivosAuto.length === 0 || indicesComConflitoAuto.size > 0} onClick={confirmarGeracaoAuto}>
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
