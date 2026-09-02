import { useState, useEffect } from 'react'
import { auth } from '../services/firebase'
import '../styles/MinhaAgenda.css'

export default function MinhaAgenda() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [escalas, setEscalas] = useState([])
  const [escalasFiltradasCorretas, setEscalasFiltradasCorretas] = useState([])
  const [mesAtual, setMesAtual] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = auth.currentUser
    setUser(currentUser)

    if (currentUser) {
      // Carregar dados do localStorage
      const usuariosData = JSON.parse(localStorage.getItem('usuarios') || '[]')
      const escalasData = JSON.parse(localStorage.getItem('escalas') || '[]')
      
      setUsuarios(usuariosData)
      
      // Encontrar usuário logado
      const usuarioEncontrado = usuariosData.find(u => u.uid === currentUser.uid)
      
      if (usuarioEncontrado) {
        setUserData(usuarioEncontrado)
        
        // FILTRO CORRETO POR ROLE
        let escalasCorretas = []
        
        if (usuarioEncontrado.role === 'tecnico' || usuarioEncontrado.role === 'analista') {
          // TÉCNICO/ANALISTA: vê APENAS suas escalas
          escalasCorretas = escalasData.filter(e => 
            Array.isArray(e.tecnicos) ? e.tecnicos.includes(currentUser.uid) : e.tecnico === currentUser.uid
          )
          console.log('🔧 Técnico logado:', usuarioEncontrado.nome, 'Escalas:', escalasCorretas.length)
        } 
        else if (usuarioEncontrado.role === 'gestor') {
          // GESTOR: vê escalas de TODOS os técnicos da sua equipe
          escalasCorretas = escalasData.filter(escala => {
            // Se tecnicos é array, verifica se algum técnico é da equipe
            if (Array.isArray(escala.tecnicos)) {
              return escala.tecnicos.some(tecnicoId => {
                const tecnico = usuariosData.find(u => u.uid === tecnicoId)
                return tecnico?.equipe === usuarioEncontrado.equipe
              })
            }
            // Fallback para campo tecnico singular
            const tecnicoEscalado = usuariosData.find(u => u.uid === escala.tecnico)
            return tecnicoEscalado?.equipe === usuarioEncontrado.equipe
          })
          console.log('👔 Gestor logado:', usuarioEncontrado.nome, 'Equipe:', usuarioEncontrado.equipe, 'Escalas:', escalasCorretas.length)
        } 
        else if (usuarioEncontrado.role === 'admin') {
          // ADMIN: vê TODAS as escalas
          escalasCorretas = escalasData
          console.log('🔐 Admin logado:', usuarioEncontrado.nome, 'Escalas:', escalasCorretas.length)
        }
        
        setEscalas(escalasData)
        setEscalasFiltradasCorretas(escalasCorretas)
      }
    }
    setLoading(false)
  }, [])

  // Gerar calendário do mês
  const gerarCalendario = () => {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)
    const diasDoMes = ultimoDia.getDate()
    const diaInicio = primeiroDia.getDay()

    const dias = []
    
    for (let i = 0; i < diaInicio; i++) {
      dias.push(null)
    }

    for (let i = 1; i <= diasDoMes; i++) {
      dias.push(new Date(ano, mes, i))
    }

    return dias
  }

  const verificarSeEscalado = (data) => {
    if (!data) return false
    const dataStr = data.toISOString().split('T')[0]
    return escalasFiltradasCorretas.some(escala => escala.data === dataStr)
  }

  const obterEscalasDoDia = (data) => {
    if (!data) return []
    const dataStr = data.toISOString().split('T')[0]
    return escalasFiltradasCorretas.filter(escala => escala.data === dataStr)
  }

  const mudarMes = (direcao) => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + direcao, 1))
  }

  const diasCalendario = gerarCalendario()
  const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const nomesDosSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="minha-agenda-container">
      <div className="agenda-header">
        <h2>📅 Minha Agenda</h2>
        <p className="agenda-subtitle">
          {userData?.role === 'tecnico' || userData?.role === 'analista' 
            ? 'Visualize seus dias escalados'
            : userData?.role === 'gestor'
            ? `Escalas da equipe ${userData?.equipe?.toUpperCase()}`
            : 'Todas as escalas'}
        </p>
      </div>

      {/* RESUMO */}
      <div className="agenda-stats">
        <div className="stat-card">
          <span className="stat-label">Total de Escalas</span>
          <span className="stat-number">{escalasFiltradasCorretas.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Próxima Escala</span>
          <span className="stat-number">
            {escalasFiltradasCorretas.length > 0 
              ? new Date(escalasFiltradasCorretas[0].data).toLocaleDateString('pt-BR')
              : 'Nenhuma'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Equipe</span>
          <span className="stat-number">{userData?.equipe?.toUpperCase() || 'N/A'}</span>
        </div>
      </div>

      {/* CALENDÁRIO */}
      <div className="calendario-wrapper">
        <div className="calendario-header">
          <button onClick={() => mudarMes(-1)} className="btn-nav">◀ Anterior</button>
          <h3>{nomesMeses[mesAtual.getMonth()]} {mesAtual.getFullYear()}</h3>
          <button onClick={() => mudarMes(1)} className="btn-nav">Próximo ▶</button>
        </div>

        <div className="calendario-dias-semana">
          {nomesDosSemana.map(dia => (
            <div key={dia} className="dia-semana-header">{dia}</div>
          ))}
        </div>

        <div className="calendario-grid">
          {diasCalendario.map((data, index) => {
            const escalado = verificarSeEscalado(data)
            const escalasDodia = obterEscalasDoDia(data)
            
            return (
              <div
                key={index}
                className={`calendario-dia ${!data ? 'vazio' : ''} ${escalado ? 'escalado' : ''}`}
              >
                {data && (
                  <>
                    <div className="dia-numero">{data.getDate()}</div>
                    {escalado && (
                      <div className="dia-status">
                        <span className="badge-escalado">✓</span>
                        {escalasDodia.map((escala, i) => (
                          <div key={i} className="escala-info">
                            <small>{escala.turno || 'Turno'}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* LISTA DE ESCALAS */}
      <div className="escalas-lista">
        <h3>📋 Escalas</h3>
        {escalasFiltradasCorretas.length > 0 ? (
          <div className="escalas-table-wrapper">
            <table className="escalas-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Turno</th>
                  <th>Técnico</th>
                  <th>Equipe</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {escalasFiltradasCorretas
                  .sort((a, b) => new Date(a.data) - new Date(b.data))
                  .map((escala, index) => {
                    // Suporta tanto array (tecnicos) quanto string (tecnico)
                    const tecnicoIds = Array.isArray(escala.tecnicos) ? escala.tecnicos : [escala.tecnico]
                    const tecnicosPrimeiros = tecnicoIds.map(id => usuarios.find(u => u.uid === id)).filter(Boolean)
                    const tecnico = tecnicosPrimeiros[0]
                    
                    const dataEscala = new Date(escala.data)
                    const agora = new Date()
                    const status = dataEscala >= agora ? 'Ativa' : 'Finalizada'

                    return (
                      <tr key={index}>
                        <td>{dataEscala.toLocaleDateString('pt-BR')}</td>
                        <td>{escala.turno || 'Não definido'}</td>
                        <td className="nome-cell">{tecnico?.nome || 'Desconhecido'}</td>
                        <td>{escala.equipe?.toUpperCase() || userData?.equipe?.toUpperCase()}</td>
                        <td>
                          <span className={`status-badge ${status === 'Ativa' ? 'ativa' : 'finalizada'}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>📭 Nenhuma escala agendada</p>
          </div>
        )}
      </div>
    </div>
  )
}