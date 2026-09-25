'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import {
  EQUIPES,
  PERFIS,
  perfisColaboradorPorEquipe,
  especialidadesPorEquipe,
  labelEquipe,
  corEquipe,
  labelPerfil,
  ehPerfilGestao,
  nuncaEhEscalado,
} from '../../lib/equipesConfig'
import { DIAS_SEMANA, ehJovemAprendiz } from '../../lib/escalasConstants'
import PainelSalas from './escalas/PainelSalas'
import { mensagemDeErro } from '../../lib/erros'
import type { Usuario, Sala, ConfigLab } from '../../types/dominio'
import '../../styles/Usuarios.css'

const CUSTOM = '__custom__'

interface FormUsuario {
  nome: string
  matricula: string
  equipe: string
  role: string
  roleCustom: string
  especialidade: string
  especialidadeCustom: string
  horarioEntrada: string
  baia: string
  baiaFixa: boolean
  elegivelHomeOffice: boolean
  diaCurso: number | string
  feriasInicio: string
  feriasFim: string
}

interface FormCriar extends FormUsuario {
  email: string
}

type DadosBaia = { equipe?: string | null; especialidade?: string | null; perfil?: string | null }

export default function Usuarios() {
  const { user, userData } = useDashboardUser()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormCriar, setShowFormCriar] = useState(false)
  const [showFormEditar, setShowFormEditar] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [filtroEquipe, setFiltroEquipe] = useState('todos')
  const [showPainelSalas, setShowPainelSalas] = useState(false)
  const [salas, setSalas] = useState<Sala[]>([])
  const [laboratorioConfig, setLaboratorioConfig] = useState<ConfigLab>({ responsavelUid: null, backupUid: null })

  const formVazioCriar: FormCriar = {
    nome: '',
    email: '',
    matricula: '',
    equipe: 'suporte',
    role: 'tecnico',
    roleCustom: '',
    especialidade: '',
    especialidadeCustom: '',
    horarioEntrada: '',
    baia: '',
    baiaFixa: false,
    elegivelHomeOffice: true,
    diaCurso: '',
    feriasInicio: '',
    feriasFim: '',
  }
  const [formCriar, setFormCriar] = useState<FormCriar>(formVazioCriar)
  const [formEditar, setFormEditar] = useState<FormUsuario>({
    nome: '',
    matricula: '',
    equipe: 'suporte',
    role: 'tecnico',
    roleCustom: '',
    especialidade: '',
    especialidadeCustom: '',
    horarioEntrada: '',
    baia: '',
    baiaFixa: false,
    elegivelHomeOffice: true,
    diaCurso: '',
    feriasInicio: '',
    feriasFim: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [excluindoUid, setExcluindoUid] = useState<string | null>(null)

  const souAdmin = userData?.role === 'admin'

  useEffect(() => {
    if (userData) {
      const equipeInicial = userData.equipe || 'suporte'
      const perfis = perfisDisponiveis(equipeInicial)
      setFormCriar(prev => ({
        ...prev,
        equipe: equipeInicial,
        role: perfis.some(p => p.id === prev.role) ? prev.role : (perfis[0]?.id || prev.role),
      }))
    }
    carregarUsuarios()
    carregarSalas()
    carregarLaboratorioConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const carregarUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios')
      const dados = await response.json()
      setUsuarios(dados)
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      setLoading(false)
    }
  }

  const podecriarUsuario = () => {
    if (!userData) return false
    return ehPerfilGestao(userData.role)
  }

  const carregarSalas = async () => {
    try {
      const response = await fetch('/api/salas')
      if (!response.ok) return
      const dados = await response.json()
      setSalas(dados.salas || [])
    } catch (error) {
      console.error('Erro ao carregar salas:', error)
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
      await carregarSalas()
      return true
    } catch (err) {
      alert(mensagemDeErro(err))
      return false
    }
  }

  const criarSala = async (valores: { nome: string; qtdBaias: number; equipes: string[] }) => {
    try {
      const response = await fetch('/api/salas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valores),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao criar')
      }
      await carregarSalas()
      return true
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
      await carregarSalas()
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
      await carregarSalas()
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
      await carregarSalas()
      return true
    } catch (err) {
      alert(mensagemDeErro(err))
      return false
    }
  }

  // Retorna true/false (sucesso) pro ConfigSala saber se pode considerar
  // aquela baia salva. `valores` é { perfil } (sala de 1 equipe só) ou
  // { equipe, especialidade } (sala compartilhada) — o formato certo já
  // vem calculado pelo ConfigSala, que sabe o modoReserva da sala.
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

  // Laboratório só existe pro Suporte por enquanto.
  const podeConfigurarLaboratorio = podecriarUsuario() && (userData?.role === 'admin' || userData?.equipe === 'suporte')

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

  const podeVerPainelSalas = podeConfigurarLaboratorio || salas.some(s => s.podeEditar)

  const equipesDisponiveis = () => {
    if (!userData) return EQUIPES
    if (userData.role === 'admin') return EQUIPES
    if (userData.role === 'gestor' || userData.role === 'lider') return EQUIPES.filter(e => e.id === userData.equipe)
    return []
  }

  // Perfis que fazem sentido pra equipe escolhida — gestor/líder/admin
  // sempre aparecem (são equipe-agnósticos), o resto depende da equipe.
  // "Admin" só aparece pra quem já é admin, e só admin ganha a opção de
  // digitar um perfil novo ("Outro").
  const perfisDisponiveis = (equipe: string | null | undefined) => {
    const permitidos = perfisColaboradorPorEquipe(equipe)
    const base = PERFIS.filter(p => {
      if (p.id === 'admin') return souAdmin
      if (p.id === 'gestor' || p.id === 'lider') return true
      return permitidos.includes(p.id)
    })
    return souAdmin ? [...base, { id: CUSTOM, label: '✏️ Outro (digitar)' }] : base
  }

  // Lista base (padrão) + qualquer especialidade que já esteja em uso por
  // alguém da equipe (ex: digitada via "Outro" antes) — assim, uma vez
  // criada, ela já aparece pronta pro próximo cadastro, sem precisar
  // mexer em código.
  const especialidadesDisponiveis = (equipe: string | null | undefined): string[] => {
    const padrao = especialidadesPorEquipe(equipe)
    const emUso = usuarios.filter(u => u.equipe === equipe && u.especialidade).map(u => u.especialidade)
    const extras = [...new Set(emUso)].filter(esp => !padrao.includes(esp))
    return [...padrao, ...extras]
  }

  // Valida o período de férias antes mesmo de tentar salvar, pra dar
  // feedback imediato em vez de só descobrir o erro depois do envio.
  const validarFerias = (inicio: string, fim: string) => {
    if (!inicio && !fim) return null
    if (!inicio || !fim) return '❌ Preencha as duas datas de férias (início e fim), ou deixe as duas em branco'
    if (fim < inicio) return '❌ A data de fim das férias não pode ser antes da data de início'
    return null
  }

  const abrirEditar = (usuario: Usuario) => {
    setUsuarioEditando(usuario)
    const roleConhecido = PERFIS.some(p => p.id === usuario.role)
    setFormEditar({
      nome: usuario.nome,
      matricula: usuario.matricula || '',
      equipe: usuario.equipe || 'suporte',
      role: roleConhecido ? usuario.role : CUSTOM,
      roleCustom: roleConhecido ? '' : usuario.role,
      especialidade: especialidadesDisponiveis(usuario.equipe).includes(usuario.especialidade) ? usuario.especialidade : (usuario.especialidade ? CUSTOM : ''),
      especialidadeCustom: especialidadesDisponiveis(usuario.equipe).includes(usuario.especialidade) ? '' : (usuario.especialidade || ''),
      horarioEntrada: usuario.horarioEntrada || '',
      baia: usuario.baia || '',
      baiaFixa: Boolean(usuario.baiaFixa),
      elegivelHomeOffice: usuario.elegivelHomeOffice !== false,
      diaCurso: usuario.diaCurso ?? '',
      feriasInicio: usuario.feriasInicio || '',
      feriasFim: usuario.feriasFim || '',
    })
    setShowFormEditar(true)
  }

  const handleCriarUsuario = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCriando(true)

    if (!formCriar.nome.trim()) {
      setError('Nome é obrigatório')
      setCriando(false)
      return
    }
    if (!formCriar.email.trim()) {
      setError('E-mail é obrigatório')
      setCriando(false)
      return
    }
    if (!formCriar.matricula.trim() && !formCriar.email.trim()) {
      setError('Informe o e-mail ou a matrícula da pessoa')
      setCriando(false)
      return
    }

    const roleFinal = formCriar.role === CUSTOM ? formCriar.roleCustom.trim() : formCriar.role
    if (!roleFinal) {
      setError('Informe o perfil')
      setCriando(false)
      return
    }
    const especialidadeFinal = formCriar.especialidade === CUSTOM ? formCriar.especialidadeCustom.trim() : formCriar.especialidade

    if (roleFinal === 'admin' && userData?.role !== 'admin') {
      setError('❌ Apenas Admin pode criar contas de Administrador')
      setCriando(false)
      return
    }

    const erroFerias = validarFerias(formCriar.feriasInicio, formCriar.feriasFim)
    if (erroFerias) {
      setError(erroFerias)
      setCriando(false)
      return
    }

    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formCriar.nome,
          email: formCriar.email,
          role: roleFinal,
          equipe: roleFinal === 'admin' ? null : formCriar.equipe,
          matricula: formCriar.matricula || null,
          especialidade: especialidadeFinal || null,
          horarioEntrada: formCriar.horarioEntrada || null,
          baia: formCriar.baia || null,
          baiaFixa: formCriar.baiaFixa,
          elegivelHomeOffice: formCriar.elegivelHomeOffice,
          diaCurso: formCriar.diaCurso === '' ? null : formCriar.diaCurso,
          feriasInicio: formCriar.feriasInicio || null,
          feriasFim: formCriar.feriasFim || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao criar usuário')
      }

      await carregarUsuarios()

      const nomeEquipe = roleFinal === 'admin' ? 'Master' : labelEquipe(formCriar.equipe)
      setSuccess(`✅ ${formCriar.nome} criado como ${labelPerfil(roleFinal)}${roleFinal === 'admin' ? '!' : ` de ${nomeEquipe}!`}`)
      setFormCriar({ ...formVazioCriar, equipe: userData?.equipe || 'suporte' })
      setShowFormCriar(false)
    } catch (err) {
      console.error('❌ Erro:', mensagemDeErro(err))
      if (mensagemDeErro(err).includes('email-already-in-use')) {
        setError('❌ Este e-mail já está cadastrado')
      } else {
        setError(`❌ Erro: ${mensagemDeErro(err)}`)
      }
    } finally {
      setCriando(false)
    }
  }

  const handleEditarUsuario = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setEditando(true)

    if (!formEditar.nome.trim()) {
      setError('Nome é obrigatório')
      setEditando(false)
      return
    }

    const roleFinal = formEditar.role === CUSTOM ? formEditar.roleCustom.trim() : formEditar.role
    if (!roleFinal) {
      setError('Informe o perfil')
      setEditando(false)
      return
    }
    const especialidadeFinal = formEditar.especialidade === CUSTOM ? formEditar.especialidadeCustom.trim() : formEditar.especialidade

    if (roleFinal === 'admin' && userData?.role !== 'admin') {
      setError('❌ Apenas Admin pode promover para Administrador')
      setEditando(false)
      return
    }

    const erroFerias = validarFerias(formEditar.feriasInicio, formEditar.feriasFim)
    if (erroFerias) {
      setError(erroFerias)
      setEditando(false)
      return
    }

    try {
      const response = await fetch(`/api/usuarios/${encodeURIComponent(String(usuarioEditando?.uid))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formEditar.nome,
          role: roleFinal,
          equipe: roleFinal === 'admin' ? null : formEditar.equipe,
          matricula: formEditar.matricula || null,
          especialidade: especialidadeFinal || null,
          horarioEntrada: formEditar.horarioEntrada || null,
          baia: formEditar.baia || null,
          baiaFixa: formEditar.baiaFixa,
          elegivelHomeOffice: formEditar.elegivelHomeOffice,
          diaCurso: formEditar.diaCurso === '' ? null : formEditar.diaCurso,
          feriasInicio: formEditar.feriasInicio || null,
          feriasFim: formEditar.feriasFim || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao editar usuário')
      }

      await carregarUsuarios()
      setSuccess(`✅ ${formEditar.nome} atualizado com sucesso!`)
      setShowFormEditar(false)
      setUsuarioEditando(null)
    } catch (err) {
      setError(`❌ Erro ao editar: ${mensagemDeErro(err)}`)
    } finally {
      setEditando(false)
    }
  }

  const handleDelete = async (uid: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário?')) return

    if (user?.uid === uid) {
      alert('Você não pode deletar sua própria conta!')
      return
    }

    setError('')
    setSuccess('')
    setExcluindoUid(uid)
    try {
      const response = await fetch(`/api/usuarios/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao deletar usuário')
      }

      await carregarUsuarios()
      setSuccess('✅ Usuário deletado com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      setError(`❌ Erro ao deletar usuário: ${mensagemDeErro(error)}`)
    } finally {
      setExcluindoUid(null)
    }
  }

  if (loading) {
    return <div className="usuarios-container"><p>Carregando usuários...</p></div>
  }

  const podeEditar = podecriarUsuario()
  // Editando a própria conta: trava perfil/equipe (não dá pra se
  // rebaixar/mudar de equipe sozinho), mas libera os outros campos —
  // matrícula, especialidade, horário, baia, férias.
  const editandoAMimMesmo = usuarioEditando?.uid === userData?.uid

  const usuariosVisiveis = () => {
    if (userData?.role === 'admin') {
      return usuarios
    }
    if (userData?.role === 'gestor' || userData?.role === 'lider') {
      return usuarios.filter(u => {
        if (u.equipe === userData.equipe && u.role !== 'admin' && u.role !== 'gestor' && u.role !== 'lider') {
          return true
        }
        if ((u.role === 'gestor' || u.role === 'lider') && u.equipe === userData.equipe && u.uid !== userData.uid) {
          return true
        }
        return false
      })
    }
    return []
  }

  return (
    <div className="usuarios-container">
      <div className="usuarios-header">
        <div>
          <h2>Gerenciar Usuários</h2>
          <p className="subtitle">Total de usuários: {usuarios.length}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {podeVerPainelSalas && (
            <button className="btn-secondary" onClick={() => setShowPainelSalas(!showPainelSalas)}>
              {showPainelSalas ? '✕ Fechar' : '🏢 Salas'}
            </button>
          )}
          {podeEditar && (
            <button className="btn-primary" onClick={() => setShowFormCriar(!showFormCriar)}>
              {showFormCriar ? '✕ Cancelar' : '+ Novo Usuário'}
            </button>
          )}
        </div>
      </div>

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
          onClose={() => setShowPainelSalas(false)}
        />
      )}

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {/* FORMULÁRIO CRIAR */}
      {podeEditar && showFormCriar && (
        <div className="modal-overlay" onClick={() => setShowFormCriar(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Criar Novo Usuário</h3>
              <button className="modal-close" onClick={() => setShowFormCriar(false)}>✕</button>
            </div>
            {error && <p className="error-message" style={{ margin: '0 20px' }}>{error}</p>}
            {success && <p className="success-message" style={{ margin: '0 20px' }}>{success}</p>}
            <form className="usuario-form usuario-form-modal" onSubmit={handleCriarUsuario}>
          <div className="form-row">
            <div className="form-group">
              <label>Nome Completo *</label>
              <input
                type="text"
                value={formCriar.nome}
                onChange={(e) => setFormCriar({...formCriar, nome: e.target.value})}
                placeholder="João Silva"
                required
                disabled={criando}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label>E-mail *</label>
              <input
                type="email"
                value={formCriar.email}
                onChange={(e) => setFormCriar({...formCriar, email: e.target.value})}
                placeholder="joao@escala.com"
                required
                disabled={criando}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Matrícula / Login de rede</label>
              <input
                type="text"
                value={formCriar.matricula}
                onChange={(e) => setFormCriar({...formCriar, matricula: e.target.value})}
                placeholder="Ex: 00123 (a senha é a de rede, não é cadastrada aqui)"
                disabled={criando}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Perfil *</label>
              <select
                value={formCriar.role}
                onChange={(e) => setFormCriar({...formCriar, role: e.target.value})}
                required
                disabled={criando}
              >
                {perfisDisponiveis(formCriar.equipe).map(perfil => (
                  <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
                ))}
              </select>
              {formCriar.role === CUSTOM && (
                <input
                  type="text"
                  value={formCriar.roleCustom}
                  onChange={(e) => setFormCriar({...formCriar, roleCustom: e.target.value})}
                  placeholder="Digite o nome do perfil"
                  className="campo-custom"
                  disabled={criando}
                />
              )}
            </div>

            {formCriar.role !== 'admin' && (
              <div className="form-group">
                <label>Equipe *</label>
                <select
                  value={formCriar.equipe}
                  onChange={(e) => {
                    const novaEquipe = e.target.value
                    const perfis = perfisDisponiveis(novaEquipe)
                    setFormCriar({
                      ...formCriar,
                      equipe: novaEquipe,
                      role: perfis.some(p => p.id === formCriar.role) ? formCriar.role : (perfis[0]?.id || formCriar.role),
                      especialidade: '',
                      especialidadeCustom: '',
                    })
                  }}
                  required
                  disabled={criando}
                >
                  {equipesDisponiveis().map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {formCriar.role !== 'admin' && (especialidadesDisponiveis(formCriar.equipe).length > 0 || souAdmin) && (
            <div className="form-row">
              <div className="form-group">
                <label>Especialidade</label>
                <select
                  value={formCriar.especialidade}
                  onChange={(e) => setFormCriar({...formCriar, especialidade: e.target.value})}
                  disabled={criando}
                >
                  <option value="">— Sem especialidade —</option>
                  {especialidadesDisponiveis(formCriar.equipe).map(esp => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                  {souAdmin && <option value={CUSTOM}>✏️ Outro (digitar)</option>}
                </select>
                {formCriar.especialidade === CUSTOM && (
                  <input
                    type="text"
                    value={formCriar.especialidadeCustom}
                    onChange={(e) => setFormCriar({...formCriar, especialidadeCustom: e.target.value})}
                    placeholder="Digite a especialidade"
                    className="campo-custom"
                    disabled={criando}
                  />
                )}
              </div>
              {ehJovemAprendiz(formCriar.role) && (
                <div className="form-group">
                  <label>Dia do curso</label>
                  <select
                    value={formCriar.diaCurso}
                    onChange={(e) => setFormCriar({...formCriar, diaCurso: e.target.value})}
                    disabled={criando}
                  >
                    <option value="">— Sem dia de curso —</option>
                    {DIAS_SEMANA.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {formCriar.role !== 'admin' && (
            <div className="form-row">
              <div className="form-group">
                <label>Horário de Entrada</label>
                <input
                  type="time"
                  value={formCriar.horarioEntrada}
                  onChange={(e) => setFormCriar({...formCriar, horarioEntrada: e.target.value})}
                  disabled={criando}
                />
              </div>
              <div className="form-group">
                <label>Preferência de baia</label>
                <select
                  value={formCriar.baia}
                  onChange={(e) => setFormCriar({...formCriar, baia: e.target.value})}
                  disabled={criando}
                >
                  <option value="">— Sem baia —</option>
                  <option value="0">⭐ Supervisor (baia especial)</option>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>Baia {n}</option>
                  ))}
                </select>
                {formCriar.baia === '0' ? (
                  <p className="campo-nota">É a baia especial do Supervisor: fica fixo automaticamente e nunca entra no rodízio de escala.</p>
                ) : (
                  <>
                    <label className="campo-toggle">
                      <span className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={formCriar.baiaFixa}
                          onChange={(e) => setFormCriar({...formCriar, baiaFixa: e.target.checked})}
                          disabled={criando}
                        />
                        <span className="toggle-switch-slider"></span>
                      </span>
                      <span>Baia fixa: essa baia é só dele. Sempre volta pra ela quando ela estiver livre e ele presencial</span>
                    </label>
                    <label className="campo-toggle">
                      <span className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={!formCriar.elegivelHomeOffice}
                          onChange={(e) => setFormCriar({...formCriar, elegivelHomeOffice: !e.target.checked})}
                          disabled={criando}
                        />
                        <span className="toggle-switch-slider"></span>
                      </span>
                      <span>Home office suspenso</span>
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
          {formCriar.role !== 'admin' && (
            <div className="form-row">
              <div className="form-group">
                <label>Férias - Início</label>
                <input
                  type="date"
                  value={formCriar.feriasInicio}
                  onChange={(e) => setFormCriar({...formCriar, feriasInicio: e.target.value})}
                  disabled={criando}
                />
              </div>
              <div className="form-group">
                <label>Férias - Fim</label>
                <input
                  type="date"
                  value={formCriar.feriasFim}
                  onChange={(e) => setFormCriar({...formCriar, feriasFim: e.target.value})}
                  disabled={criando}
                  style={validarFerias(formCriar.feriasInicio, formCriar.feriasFim) ? { borderColor: '#c0392b' } : {}}
                />
              </div>
              {validarFerias(formCriar.feriasInicio, formCriar.feriasFim) && (
                <p className="error-message" style={{ gridColumn: '1 / -1', margin: 0 }}>
                  {validarFerias(formCriar.feriasInicio, formCriar.feriasFim)}
                </p>
              )}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-success" disabled={criando || Boolean(validarFerias(formCriar.feriasInicio, formCriar.feriasFim))}>
              {criando ? '⏳ Criando...' : '✅ Criar Usuário'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowFormCriar(false)} disabled={criando}>
              Cancelar
            </button>
          </div>
            </form>
          </div>
        </div>
      )}

      {/* FORMULÁRIO EDITAR */}
      {showFormEditar && usuarioEditando && (
        <div className="modal-overlay" onClick={() => { setShowFormEditar(false); setUsuarioEditando(null) }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Usuário: {usuarioEditando.nome}</h3>
              <button className="modal-close" onClick={() => { setShowFormEditar(false); setUsuarioEditando(null) }}>✕</button>
            </div>
            {error && <p className="error-message" style={{ margin: '0 20px' }}>{error}</p>}
            {success && <p className="success-message" style={{ margin: '0 20px' }}>{success}</p>}
            <form className="usuario-form usuario-form-modal" onSubmit={handleEditarUsuario}>
          <div className="form-row">
            <div className="form-group">
              <label>Nome Completo *</label>
              <input
                type="text"
                value={formEditar.nome}
                onChange={(e) => setFormEditar({...formEditar, nome: e.target.value})}
                placeholder="João Silva"
                required
                disabled={editando}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <label>E-mail (não editável)</label>
              <input
                type="email"
                value={usuarioEditando.email}
                disabled
                style={{backgroundColor: '#f0f0f0', cursor: 'not-allowed'}}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Matrícula</label>
              <input
                type="text"
                value={formEditar.matricula}
                onChange={(e) => setFormEditar({...formEditar, matricula: e.target.value})}
                placeholder="Ex: 00123"
                disabled={editando}
                autoComplete="off"
              />
            </div>
          </div>
          {editandoAMimMesmo && (
            <p className="error-message" style={{ margin: '0 20px 15px', background: '#fff3cd', color: '#856404', borderLeft: '4px solid #f39c12' }}>
              ⚠️ Você está editando a própria conta — perfil e equipe ficam travados (só um admin pode mudar isso).
            </p>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Perfil *</label>
              <select
                value={formEditar.role}
                onChange={(e) => setFormEditar({...formEditar, role: e.target.value})}
                required
                disabled={editando || editandoAMimMesmo}
              >
                {(!souAdmin && formEditar.role === CUSTOM
                  ? [...perfisDisponiveis(formEditar.equipe), { id: CUSTOM, label: '✏️ Perfil personalizado' }]
                  : perfisDisponiveis(formEditar.equipe)
                ).map(perfil => (
                  <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
                ))}
              </select>
              {formEditar.role === CUSTOM && (
                <input
                  type="text"
                  value={formEditar.roleCustom}
                  onChange={(e) => setFormEditar({...formEditar, roleCustom: e.target.value})}
                  placeholder="Digite o nome do perfil"
                  className="campo-custom"
                  disabled={editando || editandoAMimMesmo}
                />
              )}
            </div>

            {formEditar.role !== 'admin' && (
              <div className="form-group">
                <label>Equipe *</label>
                <select
                  value={formEditar.equipe}
                  onChange={(e) => {
                    const novaEquipe = e.target.value
                    const perfis = perfisDisponiveis(novaEquipe)
                    setFormEditar({
                      ...formEditar,
                      equipe: novaEquipe,
                      role: perfis.some(p => p.id === formEditar.role) ? formEditar.role : (perfis[0]?.id || formEditar.role),
                      especialidade: '',
                      especialidadeCustom: '',
                    })
                  }}
                  required
                  disabled={editando || editandoAMimMesmo}
                >
                  {equipesDisponiveis().map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {formEditar.role !== 'admin' && (especialidadesDisponiveis(formEditar.equipe).length > 0 || souAdmin || formEditar.especialidade === CUSTOM) && (
            <div className="form-row">
              <div className="form-group">
                <label>Especialidade</label>
                <select
                  value={formEditar.especialidade}
                  onChange={(e) => setFormEditar({...formEditar, especialidade: e.target.value})}
                  disabled={editando}
                >
                  <option value="">— Sem especialidade —</option>
                  {especialidadesDisponiveis(formEditar.equipe).map(esp => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                  {(souAdmin || formEditar.especialidade === CUSTOM) && <option value={CUSTOM}>✏️ Outro (digitar)</option>}
                </select>
                {formEditar.especialidade === CUSTOM && (
                  <input
                    type="text"
                    value={formEditar.especialidadeCustom}
                    onChange={(e) => setFormEditar({...formEditar, especialidadeCustom: e.target.value})}
                    placeholder="Digite a especialidade"
                    className="campo-custom"
                    disabled={editando}
                  />
                )}
              </div>
              {ehJovemAprendiz(formEditar.role) && (
                <div className="form-group">
                  <label>Dia do curso</label>
                  <select
                    value={formEditar.diaCurso}
                    onChange={(e) => setFormEditar({...formEditar, diaCurso: e.target.value})}
                    disabled={editando}
                  >
                    <option value="">— Sem dia de curso —</option>
                    {DIAS_SEMANA.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {formEditar.role !== 'admin' && (
            <div className="form-row">
              <div className="form-group">
                <label>Horário de Entrada</label>
                <input
                  type="time"
                  value={formEditar.horarioEntrada}
                  onChange={(e) => setFormEditar({...formEditar, horarioEntrada: e.target.value})}
                  disabled={editando}
                />
              </div>
              <div className="form-group">
                <label>Preferência de baia</label>
                <select
                  value={formEditar.baia}
                  onChange={(e) => setFormEditar({...formEditar, baia: e.target.value})}
                  disabled={editando}
                >
                  <option value="">— Sem baia —</option>
                  <option value="0">⭐ Supervisor (baia especial)</option>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>Baia {n}</option>
                  ))}
                </select>
                {formEditar.baia === '0' ? (
                  <p className="campo-nota">É a baia especial do Supervisor: fica fixo automaticamente e nunca entra no rodízio de escala.</p>
                ) : (
                  <>
                    <label className="campo-toggle">
                      <span className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={formEditar.baiaFixa}
                          onChange={(e) => setFormEditar({...formEditar, baiaFixa: e.target.checked})}
                          disabled={editando}
                        />
                        <span className="toggle-switch-slider"></span>
                      </span>
                      <span>Baia fixa: essa baia é só dele. Sempre volta pra ela quando ela estiver livre e ele presencial</span>
                    </label>
                    <label className="campo-toggle">
                      <span className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={!formEditar.elegivelHomeOffice}
                          onChange={(e) => setFormEditar({...formEditar, elegivelHomeOffice: !e.target.checked})}
                          disabled={editando}
                        />
                        <span className="toggle-switch-slider"></span>
                      </span>
                      <span>Home office suspenso</span>
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
          {formEditar.role !== 'admin' && (
            <div className="form-row">
              <div className="form-group">
                <label>Férias - Início</label>
                <input
                  type="date"
                  value={formEditar.feriasInicio}
                  onChange={(e) => setFormEditar({...formEditar, feriasInicio: e.target.value})}
                  disabled={editando}
                />
              </div>
              <div className="form-group">
                <label>Férias - Fim</label>
                <input
                  type="date"
                  value={formEditar.feriasFim}
                  onChange={(e) => setFormEditar({...formEditar, feriasFim: e.target.value})}
                  disabled={editando}
                  style={validarFerias(formEditar.feriasInicio, formEditar.feriasFim) ? { borderColor: '#c0392b' } : {}}
                />
              </div>
              {validarFerias(formEditar.feriasInicio, formEditar.feriasFim) && (
                <p className="error-message" style={{ gridColumn: '1 / -1', margin: 0 }}>
                  {validarFerias(formEditar.feriasInicio, formEditar.feriasFim)}
                </p>
              )}
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn-success" disabled={editando || Boolean(validarFerias(formEditar.feriasInicio, formEditar.feriasFim))}>
              {editando ? '⏳ Salvando...' : '💾 Salvar Alterações'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => {setShowFormEditar(false); setUsuarioEditando(null)}} disabled={editando}>
              Cancelar
            </button>
          </div>
            </form>
          </div>
        </div>
      )}
      {/* TABELA DE USUÁRIOS */}
      <div className="usuarios-section">
        <div className="filtro-header">
          <h3>Usuários Cadastrados</h3>
          {userData?.role === 'admin' && (
            <div className="filtros">
              <button
                className={filtroEquipe === 'todos' ? 'active' : ''}
                onClick={() => setFiltroEquipe('todos')}
              >
                Todos
              </button>
              {EQUIPES.map(eq => (
                <button
                  key={eq.id}
                  className={filtroEquipe === eq.id ? 'active' : ''}
                  onClick={() => setFiltroEquipe(eq.id)}
                >
                  {eq.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="usuarios-table-wrapper">
          {usuariosVisiveis().filter(u => filtroEquipe === 'todos' || u.equipe === filtroEquipe).length === 0 ? (
            <p className="empty-state">Nenhum usuário para exibir</p>
          ) : (
            <table className="usuarios-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Matrícula</th>
                  <th>Equipe</th>
                  <th>Perfil</th>
                  <th>Especialidade</th>
                  <th>Horário</th>
                  <th>Baia</th>
                  <th>Férias</th>
                  {podeEditar && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {usuariosVisiveis().filter(u => filtroEquipe === 'todos' || u.equipe === filtroEquipe).map(usuario => (
                  <tr key={usuario.uid}>
                    <td className="nome-cell">
                      <strong>{usuario.nome}</strong>
                    </td>
                    <td>{usuario.email}</td>
                    <td>{usuario.matricula || '-'}</td>
                    <td>
                      {usuario.equipe ? (
                        <span className="equipe-badge" style={{background: corEquipe(usuario.equipe)}}>
                          {labelEquipe(usuario.equipe)}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`role-badge ${usuario.role}`}>
                        {labelPerfil(usuario.role)}
                      </span>
                    </td>
                    <td>{usuario.especialidade || '-'}</td>
                    <td>{usuario.horarioEntrada || '-'}</td>
                    <td>{usuario.baia || '-'}</td>
                    <td>
                      {usuario.feriasInicio && usuario.feriasFim
                        ? `${new Date(usuario.feriasInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(usuario.feriasFim + 'T00:00:00').toLocaleDateString('pt-BR')}`
                        : '-'}
                    </td>
                    {podeEditar && (
                      <td>
                        <div className="acoes">
                          {usuario.role !== 'admin' && (
                            <>
                              {(usuario.uid !== userData?.uid || userData?.role === 'gestor' || userData?.role === 'lider') && (
                                <button
                                  className="btn-editar"
                                  onClick={() => abrirEditar(usuario)}
                                  title="Editar usuário"
                                  disabled={excluindoUid === usuario.uid}
                                >
                                  ✏️ Editar
                                </button>
                              )}
                              {usuario.uid !== userData?.uid && (
                                <button
                                  className="btn-delete"
                                  onClick={() => handleDelete(usuario.uid)}
                                  title="Deletar usuário"
                                  disabled={excluindoUid === usuario.uid}
                                >
                                  {excluindoUid === usuario.uid ? '⏳ Excluindo...' : '🗑️ Deletar'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* DASHBOARD - APENAS EQUIPES REAIS */}
      <div className="usuarios-stats">
        {EQUIPES.map(eq => {
          const count = usuarios.filter(u => u.equipe === eq.id).length
          const gestores = usuarios.filter(u => u.equipe === eq.id && u.role === 'gestor').length
          return (
            <div key={eq.id} className="stat-card" style={{borderLeftColor: eq.cor}}>
              <span className="stat-label">{eq.label}</span>
              <span className="stat-number">{count}</span>
              <span className="stat-sub">{gestores} gestor(es)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
