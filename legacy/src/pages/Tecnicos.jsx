import { useState, useEffect } from 'react'
import '../styles/Tecnicos.css'

export default function Tecnicos() {
  const [tecnicos, setTecnicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    especialidade: '',
    disponivel: true
  })

  useEffect(() => {
    carregarTecnicos()
  }, [])

  const carregarTecnicos = () => {
    try {
      const dados = localStorage.getItem('tecnicos')
      if (dados) {
        setTecnicos(JSON.parse(dados))
      }
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error)
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    try {
      let novosTecnicos
      
      if (editingId) {
        novosTecnicos = tecnicos.map(t => 
          t.id === editingId ? { ...formData, id: editingId } : t
        )
      } else {
        const novoTecnico = {
          ...formData,
          id: Date.now().toString()
        }
        novosTecnicos = [...tecnicos, novoTecnico]
      }
      
      localStorage.setItem('tecnicos', JSON.stringify(novosTecnicos))
      setTecnicos(novosTecnicos)
      
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        especialidade: '',
        disponivel: true
      })
      setEditingId(null)
      setShowForm(false)
      
      alert(editingId ? 'Técnico atualizado!' : 'Técnico criado!')
    } catch (error) {
      console.error('Erro ao salvar técnico:', error)
      alert('Erro ao salvar técnico.')
    }
  }

  const handleEdit = (tecnico) => {
    setFormData(tecnico)
    setEditingId(tecnico.id)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (window.confirm('Deletar este técnico?')) {
      try {
        const novosTecnicos = tecnicos.filter(t => t.id !== id)
        localStorage.setItem('tecnicos', JSON.stringify(novosTecnicos))
        setTecnicos(novosTecnicos)
        alert('Técnico deletado!')
      } catch (error) {
        console.error('Erro ao deletar técnico:', error)
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      especialidade: '',
      disponivel: true
    })
  }

  if (loading) {
    return <div className="tecnicos-container"><p>Carregando técnicos...</p></div>
  }

  return (
    <div className="tecnicos-container">
      <div className="tecnicos-header">
        <h2>Técnicos</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Novo Técnico'}
        </button>
      </div>

      {showForm && (
        <form className="tecnico-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome *</label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
              placeholder="João Silva"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>E-mail *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="joao@escala.com"
              />
            </div>

            <div className="form-group">
              <label>Telefone</label>
              <input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Especialidade</label>
            <select
              value={formData.especialidade}
              onChange={(e) => setFormData({...formData, especialidade: e.target.value})}
            >
              <option value="">Selecione...</option>
              <option value="Suporte">Suporte</option>
              <option value="Infraestrutura">Infraestrutura</option>
              <option value="Sistemas">Sistemas</option>
            </select>
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={formData.disponivel}
                onChange={(e) => setFormData({...formData, disponivel: e.target.checked})}
              />
              Disponível
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-success">
              {editingId ? 'Atualizar' : 'Criar'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="tecnicos-list">
        {tecnicos.length === 0 ? (
          <p className="empty-state">Nenhum técnico cadastrado. Adicione o primeiro!</p>
        ) : (
          tecnicos.map(tecnico => (
            <div key={tecnico.id} className="tecnico-card">
              <div className="tecnico-header-card">
                <h3>{tecnico.nome}</h3>
                <span className={`disponibilidade ${tecnico.disponivel ? 'disponivel' : 'indisponivel'}`}>
                  {tecnico.disponivel ? '✓ Disponível' : '✗ Indisponível'}
                </span>
              </div>
              <div className="tecnico-info">
                <p><strong>E-mail:</strong> {tecnico.email}</p>
                <p><strong>Telefone:</strong> {tecnico.telefone || 'Não informado'}</p>
                <p><strong>Especialidade:</strong> {tecnico.especialidade || 'Não definida'}</p>
              </div>
              <div className="tecnico-actions">
                <button className="btn-edit" onClick={() => handleEdit(tecnico)}>Editar</button>
                <button className="btn-delete" onClick={() => handleDelete(tecnico.id)}>Deletar</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}