'use client'

import { useState, useEffect } from 'react'
import '../../styles/Relatorios.css'

export default function Relatorios() {
  const [escalas, setEscalas] = useState([])
  const [tecnicos, setTecnicos] = useState([])

  useEffect(() => {
    fetch('/api/escalas')
      .then(res => res.json())
      .then(setEscalas)
      .catch(error => console.error('Erro ao carregar escalas:', error))

    fetch('/api/tecnicos')
      .then(res => res.json())
      .then(setTecnicos)
      .catch(error => console.error('Erro ao carregar técnicos:', error))
  }, [])

  const totalEscalas = escalas.length
  const escalasAtivas = escalas.filter(e => e.status === 'ativa').length
  const totalTecnicos = tecnicos.length
  const tecnicosDisponiveis = tecnicos.filter(t => t.disponivel).length

  return (
    <div className="relatorios-container">
      <h2>Relatórios</h2>

      <div className="metricas-grid">
        <div className="metrica-card">
          <h3>Total de Escalas</h3>
          <p className="numero">{totalEscalas}</p>
          <span className="label">Escalas cadastradas</span>
        </div>

        <div className="metrica-card">
          <h3>Escalas Ativas</h3>
          <p className="numero">{escalasAtivas}</p>
          <span className="label">Em operação</span>
        </div>

        <div className="metrica-card">
          <h3>Total de Técnicos</h3>
          <p className="numero">{totalTecnicos}</p>
          <span className="label">Profissionais cadastrados</span>
        </div>

        <div className="metrica-card">
          <h3>Técnicos Disponíveis</h3>
          <p className="numero">{tecnicosDisponiveis}</p>
          <span className="label">Prontos para escala</span>
        </div>
      </div>

      <div className="relatorio-section">
        <h3>Escalas Recentes</h3>
        {escalas.length === 0 ? (
          <p className="empty">Nenhuma escala cadastrada</p>
        ) : (
          <table className="relatorio-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Período</th>
                <th>Status</th>
                <th>Técnicos</th>
              </tr>
            </thead>
            <tbody>
              {escalas.slice(-5).reverse().map(escala => (
                <tr key={escala.id}>
                  <td>{escala.titulo}</td>
                  <td>{escala.dataInicio} a {escala.dataFim}</td>
                  <td><span className={`status ${escala.status}`}>{escala.status}</span></td>
                  <td>{escala.tecnicos || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="relatorio-section">
        <h3>Técnicos Cadastrados</h3>
        {tecnicos.length === 0 ? (
          <p className="empty">Nenhum técnico cadastrado</p>
        ) : (
          <table className="relatorio-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Especialidade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tecnicos.map(tecnico => (
                <tr key={tecnico.id}>
                  <td>{tecnico.nome}</td>
                  <td>{tecnico.email}</td>
                  <td>{tecnico.especialidade || '-'}</td>
                  <td>
                    <span className={`disponibilidade ${tecnico.disponivel ? 'disponivel' : 'indisponivel'}`}>
                      {tecnico.disponivel ? 'Disponível' : 'Indisponível'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}