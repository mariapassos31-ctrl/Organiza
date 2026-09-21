'use client'

import { useState } from 'react'
import { TIPOS_ESCALA, ordenarSobreavisoPrimeiro } from '../../../lib/escalasConstants'

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function getFirstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
}

export default function CalendarioEscalas({
  escalas,
  currentMonth,
  onMonthChange,
  getNomeTecnico,
  podeEditarEscala,
  onEditarEscala,
  onDiaClick,
}) {
  const [anoInput, setAnoInput] = useState(currentMonth.getFullYear().toString())

  const getEscalasDoMes = () => {
    const ano = currentMonth.getFullYear()
    const mes = currentMonth.getMonth()
    return escalas.filter(escala => {
      const dataInicio = new Date(escala.dataInicio)
      const dataFim = new Date(escala.dataFim)
      dataFim.setDate(dataFim.getDate() + 1)
      return (
        (dataInicio.getFullYear() === ano && dataInicio.getMonth() === mes) ||
        (dataFim.getFullYear() === ano && dataFim.getMonth() === mes) ||
        (dataInicio < new Date(ano, mes, 1) && dataFim > new Date(ano, mes + 1, 0))
      )
    })
  }

  const renderCalendario = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days = []
    const escalasDoMes = getEscalasDoMes()

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dataAtual = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      const escalasDodia = ordenarSobreavisoPrimeiro(escalasDoMes.filter(escala => {
        const dataInicio = new Date(escala.dataInicio)
        const dataFim = new Date(escala.dataFim)
        dataFim.setDate(dataFim.getDate() + 1)
        return dataAtual >= dataInicio && dataAtual < dataFim
      }))

      days.push(
        <div key={day} className="calendar-day">
          <div
            className={`day-number ${escalasDodia.length > 0 ? 'day-number-clicavel' : ''}`}
            onClick={() => escalasDodia.length > 0 && onDiaClick({ data: dataAtual, escalas: escalasDodia })}
            title={escalasDodia.length > 0 ? 'Ver todos os escalados do dia' : ''}
          >
            {day}
          </div>
          <div className="day-escalas">
            {escalasDodia.map(escala => {
              const tipo = TIPOS_ESCALA.find(t => t.id === escala.tipo)
              const nomeTecnico = getNomeTecnico(escala.tecnicos[0])
              return (
                <div
                  key={escala.id}
                  className="escala-badge-beautiful"
                  style={{ backgroundColor: tipo?.cor }}
                  onClick={() => onEditarEscala(escala)}
                  title={podeEditarEscala(escala) ? 'Clique para editar' : 'Clique para ver detalhes'}
                >
                  <span className="badge-tipo-beautiful">{tipo?.label.split(' ')[0]}</span>
                  <span className="badge-tecnico-beautiful">{nomeTecnico}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    return days
  }

  return (
    <div className="calendario-container">
      <div className="calendario-header">
        <button onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
          ← Anterior
        </button>

        <div className="calendario-selector">
          <select
            value={currentMonth.getMonth()}
            onChange={(e) => onMonthChange(new Date(currentMonth.getFullYear(), parseInt(e.target.value)))}
            className="mes-select"
          >
            <option value="0">Janeiro</option>
            <option value="1">Fevereiro</option>
            <option value="2">Março</option>
            <option value="3">Abril</option>
            <option value="4">Maio</option>
            <option value="5">Junho</option>
            <option value="6">Julho</option>
            <option value="7">Agosto</option>
            <option value="8">Setembro</option>
            <option value="9">Outubro</option>
            <option value="10">Novembro</option>
            <option value="11">Dezembro</option>
          </select>

          <input
            type="text"
            value={anoInput}
            onChange={(e) => {
              const valor = e.target.value
              setAnoInput(valor)
              if (valor === '') return
              const ano = parseInt(valor)
              if (!isNaN(ano) && valor.length <= 4) {
                onMonthChange(new Date(ano, currentMonth.getMonth()))
              }
            }}
            onBlur={() => {
              setAnoInput(currentMonth.getFullYear().toString())
            }}
            onFocus={(e) => e.target.select()}
            className="ano-input"
            placeholder="Ano"
            maxLength="4"
          />
        </div>

        <button onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
          Próximo →
        </button>
      </div>
      <div className="calendario-weekdays">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>
      <div className="calendario-days">
        {renderCalendario()}
      </div>
    </div>
  )
}
