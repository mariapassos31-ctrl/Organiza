'use client'

import { useState, useEffect, type FormEvent } from 'react'

import { useDashboardUser } from '../../context/DashboardUserContext'
import { useNotificacao } from '../../context/NotificacaoContext'
import { EQUIPES, nuncaEhEscalado } from '../../lib/equipesConfig'
import { mensagemDeErro } from '../../lib/erros'
import type { Usuario, Escala, Sala, ConfigBaia, ConfigLab, FormEscala, DiaDetalhado, MarcadorSala } from '../../types/dominio'
import { TIPOS_ESCALA, ordenarSobreavisoPrimeiro, motivoInelegibilidadeParaTipo } from '../../lib/escalasConstants'
import CalendarioEscalas from './escalas/CalendarioEscalas'
import DiaDetalhadoModal from './escalas/DiaDetalhadoModal'
import EscalaEditModal from './escalas/EscalaEditModal'
import GeradorEscalaModal from './escalas/GeradorEscalaModal'
import EscalasListaDetalhada from './escalas/EscalasListaDetalhada'
import PainelSalas from './escalas/PainelSalas'
import '../../styles/Escalas.css'

type DadosBaia = { equipe?: string | null; especialidade?: string | null; perfil?: string | null }

export default function Escalas() {
  const { userData } = useDashboardUser()
  const { notificar, confirmar } = useNotificacao()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [escalas, setEscalas] = useState<Escala[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filterEquipe, setFilterEquipe] = useState('todas')
  const [filterTecnico, setFilterTecnico] = useState('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [diaDetalhado, setDiaDetalhado] = useState<DiaDetalhado | null>(null)
  const [salaFocoAtiva, setSalaFocoAtiva] = useState<{ sala: Sala; data: Date } | null>(null)
  const [salaSelecionadaId, setSalaSelecionadaId] = useState<number | null>(null)
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  // Preenchido quando o assistente é aberto a partir de um clique num dia
  // vazio do calendário — null quando aberto pelo botão normal (sem data
  // sugerida nenhuma).
  const [dataInicialNovaEscala, setDataInicialNovaEscala] = useState<string | null>(null)
  const [mostrarListaDetalhada, setMostrarListaDetalhada] = useState(false)
  const [mostrarFormTroca, setMostrarFormTroca] = useState(false)
  const [tipoTroca, setTipoTroca] = useState<'completa' | 'dias'>('completa')
  const [diasTroca, setDiasTroca] = useState<string[]>([])
  const [diasSolicitadaTroca, setDiasSolicitadaTroca] = useState<string[]>([])
  const [destinoTroca, setDestinoTroca] = useState('')
  const [enviandoTroca, setEnviandoTroca] = useState(false)
  const [escalaOferecidaId, setEscalaOferecidaId] = useState('')
  // Itens extras da mesma proposta mútua — dá pra inverter mais de um
  // dia/período numa ação só (ex: dia 6 E dia 13 de um revezamento) em vez
  // de precisar criar uma segunda troca manual depois.
  const [itensExtrasTroca, setItensExtrasTroca] = useState<Array<{
    escalaOferecidaId: string
    diasOferecidos: string[]
    escalaSolicitadaId: string
    diasSolicitados: string[]
  }>>([])
  const [trocarDireto, setTrocarDireto] = useState(false)
  // Campo próprio pra "com quem trocar" — separado do Técnico/Analista
  // (que fica travado mostrando quem já está na escala) pra não misturar
  // "quem está aqui" com "quem vai entrar", igual já funciona na troca
  // entre colegas.
  const [novoTecnicoTrocaDireto, setNovoTecnicoTrocaDireto] = useState('')
  // Uma lista só de dias — cada dia já resolve sozinho quem tinha o quê
  // (dono da escala aberta vs. o novo técnico), sem distinção entre "dia
  // principal" e "dia extra".
  const [diasTrocaDireta, setDiasTrocaDireta] = useState<string[]>([])
  const [baiasPerfil, setBaiasPerfil] = useState<Record<string, string>>({})
  const [laboratorioConfig, setLaboratorioConfig] = useState<ConfigLab>({ responsavelUid: null, backupUid: null })
  const [externoConfig, setExternoConfig] = useState<ConfigLab>({ responsavelUid: null, backupUid: null })
  const [salas, setSalas] = useState<Sala[]>([])
  const [showPainelSalas, setShowPainelSalas] = useState(false)

  const [formData, setFormData] = useState<FormEscala>({
    tipo: 'presencial',
    dataInicio: '',
    dataFim: '',
    tecnicos: [],
    equipe: 'suporte',
    descricao: '',
    status: 'ativa',
    salaId: null,
  })

  useEffect(() => {
    if (userData?.role === 'gestor' || userData?.role === 'lider') {
      setFormData(prev => ({ ...prev, equipe: userData.equipe }))
    }
    carregarUsuarios()
    carregarEscalas()
    carregarBaiasPerfil()
    carregarLaboratorioConfig()
    carregarExternoConfig()
  }, [userData])

  // O mapa do dia do Suporte só entende { [baia]: perfilId } (sala de uma
  // equipe só); o da Sala Compartilhada entende { [baia]: {equipe, especialidade} }
  // (2+ equipes) — os dois já vêm prontos nesse formato da API de Salas.
  const carregarBaiasPerfil = async () => {
    try {
      const response = await fetch('/api/salas')
      if (!response.ok) return
      const dados = await response.json()
      const listaSalas: Sala[] = dados.salas || []
      setSalas(listaSalas)

      const salaSuporte = listaSalas.find(s => s.modoReserva === 'perfil' && s.equipes.includes('suporte'))
      const mapa: Record<string, string> = {}
      for (const [baia, valor] of Object.entries<ConfigBaia>(salaSuporte?.baias ?? {})) {
        if (valor?.perfil) mapa[baia] = valor.perfil
      }
      setBaiasPerfil(mapa)
    } catch (error) {
      console.error('Erro ao carregar configuração de baias:', error)
    }
  }

  // Mudar quais equipes usam uma sala pode virar o modo de reserva dela
  // (perfil <-> equipe) e liberar baias de quem saiu — mais simples
  // recarregar a sala inteira do que tentar remendar o estado local.
  const definirEquipesSala = async (salaId: number, equipes: string[]) => {
    try {
      const response = await fetch(`/api/salas/${salaId}/equipes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipes }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      await carregarBaiasPerfil()
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  // Devolve o id da sala criada (não só true/false) — o painel usa isso
  // pra já abrir a edição dela em seguida, pra dar pra subir a imagem sem
  // precisar procurar a sala de novo na lista.
  const criarSala = async (valores: { nome: string; qtdBaias: number; equipes: string[] }) => {
    try {
      const response = await fetch('/api/salas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao criar')
      }
      await carregarBaiasPerfil()
      return data.id as number
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const editarSala = async (salaId: number, valores: { nome: string; qtdBaias: number }) => {
    try {
      const response = await fetch(`/api/salas/${salaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      await carregarBaiasPerfil()
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const excluirSala = async (salaId: number) => {
    try {
      const response = await fetch(`/api/salas/${salaId}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao excluir')
      }
      setSalas(prev => prev.filter(s => s.id !== salaId))
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const enviarImagemSala = async (salaId: number, arquivo: File) => {
    try {
      const formData = new FormData()
      formData.append('imagem', arquivo)
      const response = await fetch(`/api/salas/${salaId}/imagem`, { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao enviar imagem')
      }
      await carregarBaiasPerfil()
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const removerImagemSala = async (salaId: number) => {
    try {
      const response = await fetch(`/api/salas/${salaId}/imagem`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao remover imagem')
      }
      await carregarBaiasPerfil()
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const definirPosicoesSala = async (salaId: number, posicoes: Record<string, { top: string; left: string }>) => {
    try {
      const response = await fetch(`/api/salas/${salaId}/posicoes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posicoes }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      await carregarBaiasPerfil()
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const definirMarcadoresSala = async (salaId: number, marcadores: MarcadorSala[]) => {
    try {
      const response = await fetch(`/api/salas/${salaId}/marcadores`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marcadores }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      await carregarBaiasPerfil()
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  // Cria o grupo por trás do formato "Entre Salas" ao criar uma sala nova
  // (única forma disponível hoje de colocar salas em rodízio) — refaz a
  // lista de salas depois, que já traz o grupoRodizio de cada uma.
  const criarGrupoRodizio = async (dados: { nome: string; salaIds: number[]; equipes: string[] }) => {
    try {
      const response = await fetch('/api/grupos-rodizio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao criar')
      }
      await carregarBaiasPerfil()
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  // Retorna true/false (sucesso) pro ConfigurarSala saber se pode considerar
  // aquela baia salva. `valores` é { perfil } (sala de 1 equipe só) ou
  // { equipe, especialidade } (sala compartilhada) — o formato certo já
  // vem calculado pelo ConfigurarSala, que sabe o modoReserva da sala.
  const definirBaiaSala = async (salaId: number, baia: string, valores: DadosBaia) => {
    try {
      const response = await fetch(`/api/salas/${salaId}/baias`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baia, ...valores }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      setSalas(prev => prev.map(sala => {
        if (sala.id !== salaId) return sala
        const proximasBaias = { ...sala.baias }
        const livre = sala.modoReserva === 'equipe' ? !valores.equipe : !valores.perfil
        if (livre) {
          delete proximasBaias[baia]
        } else if (sala.modoReserva === 'equipe') {
          proximasBaias[baia] = { equipe: valores.equipe ?? undefined, especialidade: valores.especialidade || undefined }
        } else {
          proximasBaias[baia] = { perfil: valores.perfil ?? undefined }
          if (valores.perfil === 'supervisor') {
            for (const b of Object.keys(proximasBaias)) {
              if (b !== baia && proximasBaias[b]?.perfil === 'supervisor') delete proximasBaias[b]
            }
          }
        }
        return { ...sala, baias: proximasBaias }
      }))
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const carregarLaboratorioConfig = async () => {
    try {
      const response = await fetch('/api/laboratorio-config?equipe=suporte')
      if (!response.ok) return
      const dados = await response.json()
      setLaboratorioConfig({ responsavelUid: dados.responsavelUid || null, backupUid: dados.backupUid || null })
    } catch (error) {
      console.error('Erro ao carregar configuração do Laboratório:', error)
    }
  }

  // Retorna true/false (sucesso) pro ConfigLaboratorio saber se pode fechar.
  const definirLaboratorio = async (valores: ConfigLab) => {
    try {
      const response = await fetch('/api/laboratorio-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipe: 'suporte', ...valores }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      setLaboratorioConfig(valores)
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  // Mesmo padrão do Laboratório, pro Externo.
  const carregarExternoConfig = async () => {
    try {
      const response = await fetch('/api/externo-config?equipe=suporte')
      if (!response.ok) return
      const dados = await response.json()
      setExternoConfig({ responsavelUid: dados.responsavelUid || null, backupUid: dados.backupUid || null })
    } catch (error) {
      console.error('Erro ao carregar configuração do Externo:', error)
    }
  }

  // Retorna true/false (sucesso) pro ConfigExterno saber se pode fechar.
  const definirExterno = async (valores: ConfigLab) => {
    try {
      const response = await fetch('/api/externo-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipe: 'suporte', ...valores }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar')
      }
      setExternoConfig(valores)
      return true
    } catch (err) {
      notificar(mensagemDeErro(err), { tipo: 'erro' })
      return false
    }
  }

  const carregarUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios')
      const dados = await response.json()
      setUsuarios(dados)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    }
  }

  const carregarEscalas = async () => {
    try {
      const response = await fetch('/api/escalas')
      const dados = await response.json()
      setEscalas(dados)
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar escalas:', error)
      setLoading(false)
    }
  }

  const carregarTecnicosEquipe = (equipe: string | null | undefined) => {
    return usuarios.filter(u => u.equipe === equipe && u.role !== 'admin' && u.role !== 'gestor' && u.baia !== '0')
  }

  const podeEditar = userData?.role === 'admin' || userData?.role === 'gestor' || userData?.role === 'lider'
  const souAdmin = userData?.role === 'admin'
  // Laboratório só existe pro Suporte por enquanto.
  const podeConfigurarLaboratorio = podeEditar && (souAdmin || userData?.equipe === 'suporte')
  const podeVerPainelSalas = podeConfigurarLaboratorio || salas.some(s => s.podeEditar)

  const podeEditarEscala = (escala: { equipe: string | null; tecnicos?: string[] }) => {
    if (userData?.role === 'admin') return true
    if ((userData?.role === 'gestor' || userData?.role === 'lider') && escala.equipe === userData.equipe) {
      // Líder participa do rodízio normal — não edita a própria escala
      // diretamente, só pode solicitar troca com um colega (igual técnico).
      if (userData.role === 'lider' && (escala.tecnicos || []).includes(userData.uid)) return false
      return true
    }
    return false
  }

  const canEditCurrent = modalOpen && editingId ? podeEditarEscala(formData) : false

  // A opção de trocar direto fica disponível assim que dá pra editar —
  // não só depois que a pessoa já mexeu no campo de técnico. Comparado com
  // o técnico ORIGINAL (antes de qualquer edição feita nesta sessão do
  // modal), não com o valor anterior do próprio formData, pra saber quem
  // é "a pessoa antiga" na hora de submeter.
  const escalaOriginalEmEdicao = editingId ? escalas.find(e => e.id === editingId) : null
  const tecnicoOriginalUid = escalaOriginalEmEdicao?.tecnicos?.[0] ?? null
  const tecnicoFoiTrocado = Boolean(novoTecnicoTrocaDireto)
  const mostrarOpcaoTrocarDireto = canEditCurrent

  // Escalas físicas reais (presencial/home office/sábado) de qualquer um
  // dos dois envolvidos na troca direta — vira a lista de dias candidatos
  // do checklist (com o que cada um já tem em cada dia), em vez de digitar
  // uma data às cegas ou depender de uma escala específica.
  const escalasFisicasTrocaDireta = escalas
    .filter(e =>
      e.status === 'ativa' &&
      ['presencial', 'homeoffice', 'sabado'].includes(e.tipo) &&
      (e.tecnicos || []).some(uid => uid === tecnicoOriginalUid || uid === novoTecnicoTrocaDireto)
    )
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))

  useEffect(() => {
    if (!mostrarOpcaoTrocarDireto) {
      setTrocarDireto(false)
    }
  }, [mostrarOpcaoTrocarDireto])

  // Trocando de novo quem entra no lugar (ou desmarcando "trocar direto"),
  // os dias marcados antes podem não fazer mais sentido — mais simples
  // pedir pra escolher de novo do que tentar adivinhar se ainda serve.
  useEffect(() => {
    setDiasTrocaDireta([])
  }, [novoTecnicoTrocaDireto, trocarDireto])

  useEffect(() => {
    if (!trocarDireto) setNovoTecnicoTrocaDireto('')
  }, [trocarDireto])

  const souTecnico = userData?.role !== 'admin' && userData?.role !== 'gestor'
  const ehMinhaEscala = modalOpen && (formData.tecnicos || []).includes(userData?.uid ?? "")
  const podeSolicitarTroca = souTecnico && ehMinhaEscala && !canEditCurrent

  // Só entra na lista quem pode mesmo receber o tipo dessa escala — mesma
  // regra do gerador automático (Supervisor nunca, Aprendiz/Trainee nunca
  // em home office/sábado, "Externo" nunca presencial fora do sorteio).
  const colegasParaTroca = usuarios.filter(u =>
    u.equipe === userData?.equipe &&
    u.role !== 'admin' && u.role !== 'gestor' &&
    u.uid !== userData?.uid &&
    u.ativo &&
    (!formData.tipo || !motivoInelegibilidadeParaTipo(formData.tipo, {
      role: u.role,
      ehSupervisor: u.ehSupervisor,
      especialidade: u.especialidade,
      elegivelHomeOffice: u.elegivelHomeOffice,
    }))
  )

  // Escala de um colega (não minha, não editável por mim) — dá pra propor
  // trocar uma escala minha por essa, em vez de só entregar a minha. Só
  // faz sentido se eu (quem propõe) puder mesmo receber o tipo dessa
  // escala — senão o pedido nunca vai poder ser aceito.
  const donoDaEscalaAberta = usuarios.find(u => u.uid === formData.tecnicos?.[0])
  const euMesmo = usuarios.find(u => u.uid === userData?.uid)
  const podePropinTroca = Boolean(
    souTecnico && modalOpen && !ehMinhaEscala && !canEditCurrent &&
    donoDaEscalaAberta &&
    donoDaEscalaAberta.equipe === userData?.equipe &&
    donoDaEscalaAberta.role !== 'admin' && donoDaEscalaAberta.role !== 'gestor' &&
    donoDaEscalaAberta.ativo &&
    (!formData.tipo || !euMesmo || !motivoInelegibilidadeParaTipo(formData.tipo, {
      role: euMesmo.role,
      ehSupervisor: euMesmo.ehSupervisor,
      especialidade: euMesmo.especialidade,
      elegivelHomeOffice: euMesmo.elegivelHomeOffice,
    }))
  )

  const minhasEscalasParaOferecer = escalas
    .filter(e => (e.tecnicos || []).includes(userData?.uid ?? "") && e.id !== editingId)
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))

  // Escalas do mesmo colega além da que está aberta agora — alimenta o
  // dropdown de "escala do colega" dos itens extras da troca mútua.
  const escalasDoColegaParaTroca = escalas
    .filter(e => donoDaEscalaAberta && (e.tecnicos || []).includes(donoDaEscalaAberta.uid) && e.status === 'ativa')
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))

  const adicionarItemExtraTroca = () => {
    setItensExtrasTroca(prev => [...prev, { escalaOferecidaId: '', diasOferecidos: [], escalaSolicitadaId: '', diasSolicitados: [] }])
  }

  const removerItemExtraTroca = (indice: number) => {
    setItensExtrasTroca(prev => prev.filter((_, i) => i !== indice))
  }

  const atualizarItemExtraTroca = (indice: number, patch: Partial<{ escalaOferecidaId: string; diasOferecidos: string[]; escalaSolicitadaId: string; diasSolicitados: string[] }>) => {
    setItensExtrasTroca(prev => prev.map((item, i) => i === indice ? { ...item, ...patch } : item))
  }

  // Os seletores de dias (SeletorDiasSimples/SeletorDiasProporcional) usam
  // Dispatch<SetStateAction<string[]>> (aceitam tanto o valor quanto uma
  // função atualizadora) — esses helpers adaptam isso pra um item da lista.
  const setDiasOferecidosExtra = (indice: number) => (valor: string[] | ((atual: string[]) => string[])) => {
    setItensExtrasTroca(prev => prev.map((item, i) => i !== indice ? item : {
      ...item,
      diasOferecidos: typeof valor === 'function' ? valor(item.diasOferecidos) : valor,
    }))
  }

  const setDiasSolicitadosExtra = (indice: number) => (valor: string[] | ((atual: string[]) => string[])) => {
    setItensExtrasTroca(prev => prev.map((item, i) => i !== indice ? item : {
      ...item,
      diasSolicitados: typeof valor === 'function' ? valor(item.diasSolicitados) : valor,
    }))
  }

  const nomeTipoEscala = (tipoId: string) => TIPOS_ESCALA.find(t => t.id === tipoId)?.label || tipoId

  const enviarPropostaTroca = async () => {
    if (!escalaOferecidaId) {
      notificar('Selecione qual das suas escalas você quer oferecer em troca')
      return
    }
    if (diasTroca.length === 0) {
      notificar('Selecione pelo menos um dia que deseja oferecer')
      return
    }
    if (diasSolicitadaTroca.length !== diasTroca.length) {
      notificar(`Selecione exatamente ${diasTroca.length} dia(s) que você está pedindo, pra ficar equivalente`)
      return
    }
    for (const item of itensExtrasTroca) {
      if (!item.escalaOferecidaId || !item.escalaSolicitadaId) {
        notificar('Preencha a escala oferecida e a escala pedida em todos os dias/períodos extras')
        return
      }
      if (item.diasOferecidos.length === 0) {
        notificar('Selecione pelo menos um dia em cada dia/período extra que você adicionou')
        return
      }
      if (item.diasSolicitados.length !== item.diasOferecidos.length) {
        notificar(`Em cada dia/período extra, selecione exatamente a mesma quantidade de dias dos dois lados`)
        return
      }
    }
    setEnviandoTroca(true)
    try {
      const response = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalaId: escalaOferecidaId,
          tecnicoDestinoUid: donoDaEscalaAberta?.uid,
          escalaSolicitadaId: editingId,
          dias: diasTroca,
          diasSolicitada: diasSolicitadaTroca,
          itensExtras: itensExtrasTroca.map(item => ({
            escalaId: item.escalaOferecidaId,
            dias: item.diasOferecidos,
            escalaSolicitadaId: item.escalaSolicitadaId,
            diasSolicitada: item.diasSolicitados,
          })),
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao propor a troca')
      }
      notificar('Proposta de troca enviada! Acompanhe em "Trocas".', { tipo: 'sucesso' })
      handleCancel()
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setEnviandoTroca(false)
    }
  }

  const enviarSolicitacaoTroca = async () => {
    if (!destinoTroca) {
      notificar('Selecione o colega com quem deseja trocar')
      return
    }
    if (tipoTroca === 'dias' && diasTroca.length === 0) {
      notificar('Selecione pelo menos um dia que deseja trocar')
      return
    }
    setEnviandoTroca(true)
    try {
      const response = await fetch('/api/trocas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalaId: editingId,
          tecnicoDestinoUid: destinoTroca,
          dias: tipoTroca === 'dias' ? diasTroca : undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao solicitar a troca')
      }
      notificar('Solicitação de troca enviada! Acompanhe em "Trocas".', { tipo: 'sucesso' })
      handleCancel()
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    } finally {
      setEnviandoTroca(false)
    }
  }

  const escalasFiltradasPorEquipe = (filterEquipe === 'todas'
    ? escalas
    : escalas.filter(e => e.equipe === filterEquipe)
  ).filter(e => filterTecnico === 'todos' || e.tecnicos.includes(filterTecnico))

  const tecnicosParaFiltro = usuarios
    .filter(u =>
      !nuncaEhEscalado(u.role) &&
      (filterEquipe === 'todas' || u.equipe === filterEquipe)
    )
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const escalasDoDia = (data: Date) => ordenarSobreavisoPrimeiro(escalasFiltradasPorEquipe.filter(escala => {
    const dataInicio = new Date(escala.dataInicio)
    const dataFim = new Date(escala.dataFim)
    dataFim.setDate(dataFim.getDate() + 1)
    return data >= dataInicio && data < dataFim
  }))

  // Setinhas do modal do dia: troca a data e recalcula quem está escalado,
  // sem precisar fechar e clicar de novo no calendário.
  const navegarDiaDetalhado = (delta: number) => {
    setDiaDetalhado((atual) => {
      if (!atual) return atual
      const novaData = new Date(atual.data)
      novaData.setDate(novaData.getDate() + delta)
      return { data: novaData, escalas: escalasDoDia(novaData) }
    })
  }

  const abrirDiaCalendario = (dia: DiaDetalhado) => {
    setSalaFocoAtiva(null)
    setDiaDetalhado(dia)
  }

  // "Salas hoje": clicar num chip seleciona a sala e troca o calendário
  // principal pra mostrar só ela (sem filtro de equipe/técnico, sem janela
  // flutuante) — clicar de novo no mesmo chip desmarca e volta ao normal.
  // "Salas do dia": qualquer um (não só quem edita) pode ver a ocupação
  // de uma sala num dia específico — sem depender do filtro de equipe da
  // tela (que é só pra lista/calendário), por isso usa `escalas` cru.
  const escalasDoDiaSemFiltro = (data: Date) => ordenarSobreavisoPrimeiro(escalas.filter(escala => {
    const dataInicio = new Date(escala.dataInicio)
    const dataFim = new Date(escala.dataFim)
    dataFim.setDate(dataFim.getDate() + 1)
    return data >= dataInicio && data < dataFim
  }))

  const salasComMovimento = salas.filter(s => s.equipes.length > 0)
  const salaSelecionada = salasComMovimento.find(s => s.id === salaSelecionadaId) || null

  // Uma equipe vinculada a 2+ salas (ex: Infraestrutura em "Sala
  // Compartilhada" e em "Sala Infra 2") não decide sozinha em qual sala a
  // pessoa está — só a sala marcada na própria escala (salaId) diz isso.
  // Sem essa checagem, as duas salas mostrariam a mesma escala duplicada.
  const equipeEmSalaAmbigua = (equipe: string | null | undefined) =>
    salas.filter(s => s.equipes.includes(equipe ?? '')).length > 1
  // Sobreaviso e sábado são vistos por todo mundo, qualquer sala em foco —
  // não são "da" sala, são informação que toda gestão precisa enxergar.
  // Home office continua sendo "da sala que gerou ele": quando a equipe
  // está em 2+ salas, só conta se o home office tiver essa sala marcada
  // (a geração já grava isso) — senão o home office gerado pela Sala Infra
  // vazava pra dentro da Sala do Suporte também, só por ser da mesma
  // equipe. Sem sala marcada e equipe não-ambígua, conta normal.
  const escalaPertenceASala = (e: Escala, sala: Sala) => {
    if (e.tipo === 'sobreaviso' || e.tipo === 'sabado') return true
    if (!sala.equipes.includes(e.equipe ?? '')) return false
    return !equipeEmSalaAmbigua(e.equipe) || e.salaId === sala.id
  }

  const contarPresencialHoje = (sala: Sala) => escalasDoDiaSemFiltro(new Date()).filter(e =>
    escalaPertenceASala(e, sala) && (e.tipo === 'presencial' || e.tipo === 'sabado')
  ).length

  const selecionarSala = (sala: Sala) => {
    setSalaSelecionadaId(prev => prev === sala.id ? null : sala.id)
    setDiaDetalhado(null)
    setSalaFocoAtiva(null)
  }

  const escalasParaCalendario = salaSelecionada
    ? escalas.filter(e => escalaPertenceASala(e, salaSelecionada))
    : escalasFiltradasPorEquipe

  const clicarDiaCalendario = (dia: DiaDetalhado) => {
    if (salaSelecionada) {
      setSalaFocoAtiva({ sala: salaSelecionada, data: dia.data })
    } else {
      abrirDiaCalendario(dia)
    }
  }

  // Dia sem nenhuma escala: em vez de não fazer nada, abre o assistente de
  // criação já com essa data sugerida como início.
  const clicarDiaVazioCalendario = (data: Date) => {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    setDataInicialNovaEscala(`${ano}-${mes}-${dia}`)
    setAutoModalOpen(true)
  }

  const diaDetalhadoSalaFoco: DiaDetalhado | null = salaFocoAtiva
    ? {
        data: salaFocoAtiva.data,
        escalas: escalasDoDiaSemFiltro(salaFocoAtiva.data).filter(e => escalaPertenceASala(e, salaFocoAtiva.sala)),
      }
    : null

  const navegarSalaFoco = (delta: number) => {
    setSalaFocoAtiva((atual) => {
      if (!atual) return atual
      const novaData = new Date(atual.data)
      novaData.setDate(novaData.getDate() + delta)
      return { ...atual, data: novaData }
    })
  }

  // Troca direta: as DUAS pontas são escolhidas explicitamente — a
  // escala/dias de quem sai (a que está sendo editada) e a escala/dias de
  // quem entra (escolhida no seletor "em troca, o que ele(a) oferece"),
  // ambas do mesmo tipo. Sem pedido de aceite: quem está editando já tem
  // permissão de gestão.
  const formatarBR = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')

  const formatarPeriodo = (p: { dias?: string[]; dataInicio?: string; dataFim?: string }) => {
    if (p.dias && p.dias.length > 0) {
      const datas = [...p.dias].sort().map(formatarBR)
      if (datas.length === 1) return datas[0]
      return `${datas.slice(0, -1).join(', ')} e ${datas[datas.length - 1]}`
    }
    return `${formatarBR(p.dataInicio!)} a ${formatarBR(p.dataFim!)}`
  }

  // Especialidade Externo nunca pode ficar Presencial (não ocupa baia) — em
  // vez de deixar a troca travar nisso, qualquer dia marcado onde isso
  // esbarraria já vai identificado aqui: quem tem a especialidade Externo
  // simplesmente NÃO recebe escala nesse dia (fica na vaga do Externo, ou o
  // backup assume). O EscalaEditModal já avisa isso no rótulo do dia antes
  // de marcar.
  const diasComoHomeOfficeParaExterno = (dias: string[]): string[] => {
    const especialidade = (uid: string | null) => usuarios.find(u => u.uid === uid)?.especialidade
    const tipoNoDia = (uid: string | null, dia: string) =>
      escalasFisicasTrocaDireta.find(e => e.tecnicos[0] === uid && dia >= e.dataInicio && dia <= e.dataFim)?.tipo
    return dias.filter(dia =>
      (tipoNoDia(tecnicoOriginalUid, dia) === 'presencial' && especialidade(novoTecnicoTrocaDireto) === 'Externo') ||
      (tipoNoDia(novoTecnicoTrocaDireto, dia) === 'presencial' && especialidade(tecnicoOriginalUid) === 'Externo')
    )
  }

  const salvarTrocaDireta = async (): Promise<void> => {
    if (diasTrocaDireta.length === 0) {
      notificar('Selecione pelo menos um dia pra trocar')
      return
    }
    try {
      const response = await fetch(`/api/escalas/${encodeURIComponent(String(editingId))}/trocar-direto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          novoTecnicoUid: novoTecnicoTrocaDireto,
          dias: diasTrocaDireta,
          diasComoHomeOffice: diasComoHomeOfficeParaExterno(diasTrocaDireta),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao trocar escala')
      }

      const nomeAntigo = getNomeTecnico(tecnicoOriginalUid ?? '')
      const nomeNovo = getNomeTecnico(novoTecnicoTrocaDireto)
      // "novoAssumiu" é o que era do antigo e passou pro novo; "antigoAssumiu"
      // é o inverso — cada dia já resolveu sozinho quem tinha o quê.
      const novoAssumiu: Array<{ tipo: string; dias: string[] }> = data.novoAssumiu || []
      const antigoAssumiu: Array<{ tipo: string; dias: string[] }> = data.antigoAssumiu || []

      await carregarEscalas()
      setEditingId(null)
      setModalOpen(false)
      setTrocarDireto(false)

      // "externo" não é um tipo de escala de verdade — é o caso em que
      // quem tem a especialidade Externo não recebeu nada (ficou na vaga
      // do Externo em vez de assumir uma escala), então tem frase própria.
      const rotularAssuncao = (nome: string, fragmentos: Array<{ tipo: string; dias: string[] }>): string =>
        fragmentos.map(f => f.tipo === 'externo'
          ? `${nome} ficou na vaga do Externo (sem escala própria) em ${formatarPeriodo({ dias: f.dias })}`
          : `${nome} assumiu ${nomeTipoEscala(f.tipo)} em ${formatarPeriodo({ dias: f.dias })}`
        ).join(' e ') + '.'

      const partes = [
        novoAssumiu.length > 0 && rotularAssuncao(nomeNovo, novoAssumiu),
        antigoAssumiu.length > 0 && rotularAssuncao(nomeAntigo, antigoAssumiu),
      ].filter(Boolean)

      notificar(partes.join('\n'), { tipo: 'sucesso', titulo: '🔄 Troca feita!' })
    } catch (error) {
      notificar(mensagemDeErro(error), { tipo: 'erro' })
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formData.dataInicio || !formData.dataFim || formData.tecnicos.length === 0) {
      notificar('Preencha os campos obrigatórios!')
      return
    }
    if (!podeEditarEscala(formData)) {
      notificar('Você não tem permissão para editar esta escala', { tipo: 'erro' })
      return
    }
    if (trocarDireto) {
      if (!tecnicoFoiTrocado) {
        notificar('Escolha, no campo "Trocar com quem?", a pessoa que vai entrar no lugar')
        return
      }
      await salvarTrocaDireta()
      return
    }
    try {
      const payload = {
        tipo: formData.tipo,
        dataInicio: formData.dataInicio,
        dataFim: formData.dataFim,
        tecnicos: formData.tecnicos,
        equipe: (userData?.role === 'gestor' || userData?.role === 'lider') ? userData.equipe : formData.equipe,
        descricao: formData.descricao,
        status: formData.status,
        salaId: formData.salaId,
      }

      const response = await fetch(`/api/escalas/${encodeURIComponent(String(editingId))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao salvar escala')
      }

      await carregarEscalas()
      setEditingId(null)
      setModalOpen(false)
      notificar('Escala atualizada com sucesso!', { tipo: 'sucesso' })
    } catch (error) {
      console.error('Erro ao salvar escala:', error)
      notificar('Erro ao salvar escala', { tipo: 'erro' })
    }
  }

  const handleEdit = (escala: Escala) => {
    setFormData(escala)
    setEditingId(escala.id)
    setModalOpen(true)
    setMostrarFormTroca(false)
    setTipoTroca('completa')
    setDiasTroca([])
    setDiasSolicitadaTroca([])
    setDestinoTroca('')
    setEscalaOferecidaId('')
    setItensExtrasTroca([])
    setTrocarDireto(false)
    setNovoTecnicoTrocaDireto('')
    setDiasTrocaDireta([])
  }

  const handleDelete = async (id: string) => {
    const escala = escalas.find(e => e.id === id)
    if (!escala) {
      notificar('Escala não encontrada', { tipo: 'erro' })
      return
    }
    if (!podeEditarEscala(escala)) {
      notificar('Você não tem permissão para deletar esta escala', { tipo: 'erro' })
      return
    }
    if (await confirmar('Mover esta escala para a lixeira?', { titulo: 'Deletar escala', textoConfirmar: 'Mover' })) {
      try {
        const response = await fetch(`/api/escalas/${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Falha ao deletar escala')
        }
        await carregarEscalas()
        setModalOpen(false)
        notificar('Escala movida para a lixeira. Fica lá por 7 dias, dá pra restaurar se precisar.', { tipo: 'sucesso' })
      } catch (error) {
        console.error('Erro ao deletar escala:', error)
        notificar('Erro ao deletar escala. Tente novamente.', { tipo: 'erro' })
      }
    }
  }

  const handleCancel = () => {
    setModalOpen(false)
    setEditingId(null)
    setFormData({
      tipo: 'presencial',
      dataInicio: '',
      dataFim: '',
      tecnicos: [],
      equipe: 'suporte',
      descricao: '',
      status: 'ativa',
      salaId: null,
    })
    setMostrarFormTroca(false)
    setDiasSolicitadaTroca([])
    setItensExtrasTroca([])
    setTrocarDireto(false)
    setNovoTecnicoTrocaDireto('')
    setDiasTrocaDireta([])
  }

  const getNomeTecnico = (uid: string) => {
    const tecnico = usuarios.find(u => u.uid === uid)
    return tecnico?.nome || 'Desconhecido'
  }

  if (loading) {
    return <div className="escalas-container"><p>Carregando escalas...</p></div>
  }

  return (
    <div className="escalas-container">
      <div className="escalas-header">
        <div>
          <h2>📅 Escalas</h2>
          <p className="subtitle">Gerenciamento de escalas por equipe</p>
        </div>
        <div className="escalas-header-actions">
          {podeVerPainelSalas && (
            <button className="btn-secondary" onClick={() => setShowPainelSalas(!showPainelSalas)}>
              {showPainelSalas ? '✕ Fechar' : '🏢 Salas'}
            </button>
          )}
          {podeEditar && (
            <button className="btn-primary" onClick={() => { setDataInicialNovaEscala(null); setAutoModalOpen(true) }}>
              🪄 Nova Escala
            </button>
          )}
        </div>
      </div>

      {salasComMovimento.length > 0 && (
        <div className="escalas-salas-do-dia">
          <span className="escalas-salas-do-dia-titulo">Salas hoje:</span>
          {salasComMovimento.map(sala => (
            <button
              key={sala.id}
              type="button"
              className={`escalas-salas-do-dia-chip${salaSelecionadaId === sala.id ? ' escalas-salas-do-dia-chip-ativo' : ''}`}
              onClick={() => selecionarSala(sala)}
            >
              🏢 {sala.nome}
              <span className="escalas-salas-do-dia-contagem">{contarPresencialHoje(sala)}</span>
            </button>
          ))}
        </div>
      )}

      {/* SALAS (baias do Suporte, sala compartilhada, Laboratório) */}
      {podeVerPainelSalas && showPainelSalas && (
        <PainelSalas
          salas={salas}
          podeConfigurarLaboratorio={podeConfigurarLaboratorio}
          laboratorioProps={{
            tecnicos: usuarios.filter(u => u.equipe === 'suporte' && !nuncaEhEscalado(u.role)).sort((a, b) => a.nome.localeCompare(b.nome)),
            valorInicial: laboratorioConfig,
            onSalvar: definirLaboratorio,
          }}
          podeConfigurarExterno={podeConfigurarLaboratorio}
          externoProps={{
            tecnicos: usuarios.filter(u => u.equipe === 'suporte' && !nuncaEhEscalado(u.role)).sort((a, b) => a.nome.localeCompare(b.nome)),
            valorInicial: externoConfig,
            onSalvar: definirExterno,
          }}
          podeConfigurarFilaSabado={podeConfigurarLaboratorio}
          usuarios={usuarios}
          minhaEquipe={userData?.equipe}
          souAdmin={souAdmin}
          onAlterarBaiaSala={definirBaiaSala}
          onAlterarEquipesSala={definirEquipesSala}
          onCriarSala={criarSala}
          onEditarSala={editarSala}
          onExcluirSala={excluirSala}
          onEnviarImagemSala={enviarImagemSala}
          onRemoverImagemSala={removerImagemSala}
          onAjustarPosicoesSala={definirPosicoesSala}
          onAjustarMarcadoresSala={definirMarcadoresSala}
          onCriarGrupoRodizio={criarGrupoRodizio}
          onClose={() => setShowPainelSalas(false)}
        />
      )}

      <div className="escalas-toolbar">
        <div className="escalas-filters">
          <label>Filtrar por Equipe:</label>
          <select
            value={filterEquipe}
            onChange={(e) => {
              setFilterEquipe(e.target.value)
              setFilterTecnico('todos')
            }}
          >
            <option value="todas">📊 Todas as Equipes</option>
            {EQUIPES.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.label}</option>
            ))}
          </select>

          <label>Filtrar por Técnico/Analista:</label>
          <select value={filterTecnico} onChange={(e) => setFilterTecnico(e.target.value)}>
            <option value="todos">👥 Todos</option>
            {tecnicosParaFiltro.map(t => (
              <option key={t.uid} value={t.uid}>{t.nome}</option>
            ))}
          </select>
        </div>

        <div className="escalas-legenda">
          {TIPOS_ESCALA.map(tipo => (
            <div key={tipo.id} className="legenda-item">
              <div className="legenda-cor" style={{ backgroundColor: tipo.cor }}></div>
              <span>{tipo.label}</span>
            </div>
          ))}
        </div>
      </div>

      <EscalaEditModal
        open={modalOpen}
        formData={formData}
        setFormData={setFormData}
        salas={salas}
        canEdit={canEditCurrent}
        isAdmin={userData?.role === 'admin'}
        tecnicosDisponiveis={carregarTecnicosEquipe(userData?.role === 'admin' ? formData.equipe : userData?.equipe)}
        getNomeTecnico={getNomeTecnico}
        onSubmit={handleSubmit}
        onDelete={() => handleDelete(editingId as string)}
        onCancel={handleCancel}
        podeSolicitarTroca={podeSolicitarTroca}
        colegasParaTroca={colegasParaTroca}
        mostrarFormTroca={mostrarFormTroca}
        onAbrirFormTroca={() => setMostrarFormTroca(true)}
        onFecharFormTroca={() => setMostrarFormTroca(false)}
        tipoTroca={tipoTroca}
        setTipoTroca={setTipoTroca}
        diasTroca={diasTroca}
        setDiasTroca={setDiasTroca}
        destinoTroca={destinoTroca}
        setDestinoTroca={setDestinoTroca}
        enviandoTroca={enviandoTroca}
        onEnviarTroca={enviarSolicitacaoTroca}
        podePropinTroca={podePropinTroca}
        minhasEscalasParaOferecer={minhasEscalasParaOferecer}
        nomeTipoEscala={nomeTipoEscala}
        escalaOferecidaId={escalaOferecidaId}
        setEscalaOferecidaId={setEscalaOferecidaId}
        diasSolicitadaTroca={diasSolicitadaTroca}
        setDiasSolicitadaTroca={setDiasSolicitadaTroca}
        escalasDoColegaParaTroca={escalasDoColegaParaTroca}
        itensExtrasTroca={itensExtrasTroca}
        onAdicionarItemExtraTroca={adicionarItemExtraTroca}
        onRemoverItemExtraTroca={removerItemExtraTroca}
        onAtualizarItemExtraTroca={atualizarItemExtraTroca}
        setDiasOferecidosExtra={setDiasOferecidosExtra}
        setDiasSolicitadosExtra={setDiasSolicitadosExtra}
        onEnviarPropostaTroca={enviarPropostaTroca}
        mostrarOpcaoTrocarDireto={mostrarOpcaoTrocarDireto}
        nomeTecnicoOriginal={getNomeTecnico(tecnicoOriginalUid ?? '')}
        tecnicoOriginalUid={tecnicoOriginalUid}
        tecnicoFoiTrocado={tecnicoFoiTrocado}
        trocarDireto={trocarDireto}
        setTrocarDireto={setTrocarDireto}
        novoTecnicoTrocaDireto={novoTecnicoTrocaDireto}
        setNovoTecnicoTrocaDireto={setNovoTecnicoTrocaDireto}
        diasTrocaDireta={diasTrocaDireta}
        setDiasTrocaDireta={setDiasTrocaDireta}
        escalasFisicasTrocaDireta={escalasFisicasTrocaDireta}
      />

      {autoModalOpen && (
        <GeradorEscalaModal
          userData={userData}
          usuarios={usuarios}
          salas={salas}
          onClose={() => setAutoModalOpen(false)}
          onAtualizarEscalas={carregarEscalas}
          dataInicial={dataInicialNovaEscala ?? undefined}
        />
      )}

      <CalendarioEscalas
        escalas={escalasParaCalendario}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        getNomeTecnico={getNomeTecnico}
        podeEditarEscala={podeEditarEscala}
        onEditarEscala={handleEdit}
        onDiaClick={clicarDiaCalendario}
        onDiaVazioClick={podeEditar ? clicarDiaVazioCalendario : undefined}
        usuarios={usuarios}
      />

      <DiaDetalhadoModal
        diaDetalhado={diaDetalhado}
        onClose={() => setDiaDetalhado(null)}
        onNavegarDia={navegarDiaDetalhado}
        podeEditarEscala={podeEditarEscala}
        onEditarEscala={handleEdit}
        getNomeTecnico={getNomeTecnico}
        usuarios={usuarios}
        baiasPerfil={baiasPerfil}
        laboratorioConfig={laboratorioConfig}
        externoConfig={externoConfig}
        salas={salas}
        todasAsSalas={salas}
      />

      <DiaDetalhadoModal
        diaDetalhado={diaDetalhadoSalaFoco}
        onClose={() => setSalaFocoAtiva(null)}
        onNavegarDia={navegarSalaFoco}
        podeEditarEscala={podeEditarEscala}
        onEditarEscala={handleEdit}
        getNomeTecnico={getNomeTecnico}
        usuarios={usuarios}
        baiasPerfil={baiasPerfil}
        laboratorioConfig={laboratorioConfig}
        externoConfig={externoConfig}
        salas={salaFocoAtiva ? [salaFocoAtiva.sala] : []}
        todasAsSalas={salas}
      />

      <div className="escalas-lista-detalhada-toggle">
        <label className="campo-toggle">
          <span className="toggle-switch">
            <input
              type="checkbox"
              checked={mostrarListaDetalhada}
              onChange={(e) => setMostrarListaDetalhada(e.target.checked)}
            />
            <span className="toggle-switch-slider"></span>
          </span>
          <span>Ver escalas detalhadas</span>
        </label>
      </div>

      {mostrarListaDetalhada && (
        <EscalasListaDetalhada
          escalas={escalasParaCalendario}
          usuarios={usuarios}
          getNomeTecnico={getNomeTecnico}
          podeEditarEscala={podeEditarEscala}
          onEditarEscala={handleEdit}
          onDeletarEscala={handleDelete}
          onAtualizarEscalas={carregarEscalas}
        />
      )}
    </div>
  )
}
