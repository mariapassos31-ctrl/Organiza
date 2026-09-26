'use client'

import { useState, useEffect, type FormEvent } from 'react'

import { useDashboardUser } from '../../context/DashboardUserContext'
import { EQUIPES, nuncaEhEscalado } from '../../lib/equipesConfig'
import { mensagemDeErro } from '../../lib/erros'
import type { Usuario, Escala, Sala, ConfigBaia, ConfigLab, FormEscala, DiaDetalhado, MarcadorSala } from '../../types/dominio'
import { TIPOS_ESCALA, ordenarSobreavisoPrimeiro } from '../../lib/escalasConstants'
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
  const [mostrarListaDetalhada, setMostrarListaDetalhada] = useState(false)
  const [mostrarFormTroca, setMostrarFormTroca] = useState(false)
  const [tipoTroca, setTipoTroca] = useState('completa')
  const [diaTroca, setDiaTroca] = useState('')
  const [destinoTroca, setDestinoTroca] = useState('')
  const [enviandoTroca, setEnviandoTroca] = useState(false)
  const [escalaOferecidaId, setEscalaOferecidaId] = useState('')
  const [baiasPerfil, setBaiasPerfil] = useState<Record<string, string>>({})
  const [laboratorioConfig, setLaboratorioConfig] = useState<ConfigLab>({ responsavelUid: null, backupUid: null })
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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
      alert(mensagemDeErro(err))
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

  const souTecnico = userData?.role !== 'admin' && userData?.role !== 'gestor'
  const ehMinhaEscala = modalOpen && (formData.tecnicos || []).includes(userData?.uid ?? "")
  const podeSolicitarTroca = souTecnico && ehMinhaEscala && !canEditCurrent

  const colegasParaTroca = usuarios.filter(u =>
    u.equipe === userData?.equipe &&
    u.role !== 'admin' && u.role !== 'gestor' &&
    u.uid !== userData?.uid &&
    u.ativo
  )

  // Escala de um colega (não minha, não editável por mim) — dá pra propor
  // trocar uma escala minha por essa, em vez de só entregar a minha.
  const donoDaEscalaAberta = usuarios.find(u => u.uid === formData.tecnicos?.[0])
  const podePropinTroca = Boolean(
    souTecnico && modalOpen && !ehMinhaEscala && !canEditCurrent &&
    donoDaEscalaAberta &&
    colegasParaTroca.some(c => c.uid === donoDaEscalaAberta.uid)
  )

  const minhasEscalasParaOferecer = escalas
    .filter(e => (e.tecnicos || []).includes(userData?.uid ?? "") && e.id !== editingId)
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))

  const nomeTipoEscala = (tipoId: string) => TIPOS_ESCALA.find(t => t.id === tipoId)?.label || tipoId

  const enviarPropostaTroca = async () => {
    if (!escalaOferecidaId) {
      alert('Selecione qual das suas escalas você quer oferecer em troca')
      return
    }
    if (tipoTroca === 'dia' && !diaTroca) {
      alert('Selecione o dia que deseja oferecer')
      return
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
          dia: tipoTroca === 'dia' ? diaTroca : undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao propor a troca')
      }
      alert('Proposta de troca enviada! Acompanhe em "Trocas".')
      handleCancel()
    } catch (error) {
      alert(mensagemDeErro(error))
    } finally {
      setEnviandoTroca(false)
    }
  }

  const enviarSolicitacaoTroca = async () => {
    if (!destinoTroca) {
      alert('Selecione o colega com quem deseja trocar')
      return
    }
    if (tipoTroca === 'dia' && !diaTroca) {
      alert('Selecione o dia que deseja trocar')
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
          dia: tipoTroca === 'dia' ? diaTroca : undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao solicitar a troca')
      }
      alert('Solicitação de troca enviada! Acompanhe em "Trocas".')
      handleCancel()
    } catch (error) {
      alert(mensagemDeErro(error))
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formData.dataInicio || !formData.dataFim || formData.tecnicos.length === 0) {
      alert('Preencha os campos obrigatórios!')
      return
    }
    if (!podeEditarEscala(formData)) {
      alert('Você não tem permissão para editar esta escala')
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
      alert('Escala atualizada com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar escala:', error)
      alert('Erro ao salvar escala')
    }
  }

  const handleEdit = (escala: Escala) => {
    setFormData(escala)
    setEditingId(escala.id)
    setModalOpen(true)
    setMostrarFormTroca(false)
    setTipoTroca('completa')
    setDiaTroca('')
    setDestinoTroca('')
    setEscalaOferecidaId('')
  }

  const handleDelete = async (id: string) => {
    const escala = escalas.find(e => e.id === id)
    if (!escala) {
      alert('Escala não encontrada')
      return
    }
    if (!podeEditarEscala(escala)) {
      alert('Você não tem permissão para deletar esta escala')
      return
    }
    if (window.confirm('Tem certeza que deseja deletar esta escala?')) {
      try {
        const response = await fetch(`/api/escalas/${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Falha ao deletar escala')
        }
        await carregarEscalas()
        setModalOpen(false)
        alert('Escala deletada com sucesso!')
      } catch (error) {
        console.error('Erro ao deletar escala:', error)
        alert('Erro ao deletar escala. Tente novamente.')
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
            <button className="btn-primary" onClick={() => setAutoModalOpen(true)}>
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
        diaTroca={diaTroca}
        setDiaTroca={setDiaTroca}
        destinoTroca={destinoTroca}
        setDestinoTroca={setDestinoTroca}
        enviandoTroca={enviandoTroca}
        onEnviarTroca={enviarSolicitacaoTroca}
        podePropinTroca={podePropinTroca}
        minhasEscalasParaOferecer={minhasEscalasParaOferecer}
        nomeTipoEscala={nomeTipoEscala}
        escalaOferecidaId={escalaOferecidaId}
        setEscalaOferecidaId={setEscalaOferecidaId}
        onEnviarPropostaTroca={enviarPropostaTroca}
      />

      {autoModalOpen && (
        <GeradorEscalaModal
          userData={userData}
          usuarios={usuarios}
          salas={salas}
          onClose={() => setAutoModalOpen(false)}
          onAtualizarEscalas={carregarEscalas}
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
