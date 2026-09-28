'use client'

import { useState, useEffect, type ReactNode } from 'react'
import type { Escala, Usuario } from '../../../types/dominio'
import { TIPOS_ESCALA, TIPO_CURSO, ordenarSobreavisoPrimeiro, estaEmDiaCurso } from '../../../lib/escalasConstants'
import { nomeFeriado } from '../../../lib/feriados'

function getDaysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function getFirstDayOfMonth(date: Date) {
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
  onDiaVazioClick,
  usuarios,
}: {
  escalas: Escala[]
  currentMonth: Date
  onMonthChange: (data: Date) => void
  getNomeTecnico: (uid: string) => string
  podeEditarEscala: (escala: Escala) => boolean
  onEditarEscala: (escala: Escala) => void
  onDiaClick: (dia: { data: Date; escalas: Escala[] }) => void
  // Clique num dia sem nenhuma escala — abre o assistente de criação já
  // com essa data preenchida, em vez de não fazer nada.
  onDiaVazioClick?: (data: Date) => void
  usuarios?: Usuario[]
}) {
  const [anoInput, setAnoInput] = useState(currentMonth.getFullYear().toString())

  // O campo de ano tem estado próprio (pra digitar livremente sem travar a
  // cada tecla), mas precisa acompanhar currentMonth quando o mês muda por
  // outro caminho (setas ← →, virando o ano) — senão fica mostrando o ano
  // antigo mesmo com o calendário já certo.
  useEffect(() => {
    setAnoInput(currentMonth.getFullYear().toString())
  }, [currentMonth])

  // Direto contra a lista inteira de escalas (não só as "do mês") — assim
  // funciona igual pra dia do mês atual e pros dias de mês vizinho que
  // completam a primeira/última semana da grade.
  const escalasDoDia = (data: Date) => ordenarSobreavisoPrimeiro(escalas.filter(escala => {
    const dataInicio = new Date(escala.dataInicio)
    const dataFim = new Date(escala.dataFim)
    dataFim.setDate(dataFim.getDate() + 1)
    return data >= dataInicio && data < dataFim
  }))

  const formatarISO = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`

  // Uma célula do calendário — usada tanto pros dias do mês em foco quanto
  // pros dias de mês vizinho que sobram na primeira/última semana (esses
  // vêm com foraDoMes=true, só pra ficar visualmente mais apagados e não
  // confundir com o mês atual; o resto do comportamento — clicar pra ver
  // ou criar escala — é idêntico, já que é sempre uma data real).
  const renderDia = (dataAtual: Date, foraDoMes: boolean) => {
    const dataISO = formatarISO(dataAtual)
    const feriado = nomeFeriado(dataISO)
    const escalasDodia = escalasDoDia(dataAtual)
    // Quando o dia tem gente de home office, esconde os presenciais no
    // calendário (são a maioria, viram poluição visual) — a lupa continua
    // mostrando todo mundo. Dia sem home office (outras equipes/modos)
    // mostra tudo normalmente, senão ficaria em branco.
    const temHomeOfficeNoDia = escalasDodia.some(e => e.tipo === 'homeoffice')
    const escalasParaExibir = temHomeOfficeNoDia
      ? escalasDodia.filter(e => e.tipo !== 'presencial')
      : escalasDodia

    // O dia inteiro abre o detalhe, não só o numerozinho — no celular as
    // escalas viram bolinhas de 9px e não dá pra mirar nelas; no
    // computador continua valendo clicar direto na etiqueta pra editar
    // (ela para a propagação logo abaixo). Dia vazio (sem nenhuma escala)
    // abre o assistente de criação já com essa data, em vez de não fazer
    // nada — só quando quem está vendo pode de fato criar escala.
    const abrirDia = () => {
      if (escalasDodia.length > 0) {
        onDiaClick({ data: dataAtual, escalas: escalasDodia })
      } else if (onDiaVazioClick) {
        onDiaVazioClick(dataAtual)
      }
    }
    const diaClicavel = escalasDodia.length > 0 || Boolean(onDiaVazioClick)

    return (
      <div
        key={dataISO}
        className={`calendar-day ${feriado ? 'calendar-day-feriado' : ''} ${diaClicavel ? 'calendar-day-clicavel' : ''} ${escalasDodia.length > 0 ? 'calendar-day-com-escalas' : ''} ${foraDoMes ? 'calendar-day-fora-do-mes' : ''}`}
        onClick={abrirDia}
      >
        <div
          className={`day-number ${escalasDodia.length > 0 ? 'day-number-clicavel' : ''}`}
          title={escalasDodia.length > 0 ? 'Ver todos os escalados do dia' : (onDiaVazioClick ? 'Criar escala nesse dia' : '')}
        >
          {dataAtual.getDate()}
          {escalasDodia.length > 0 && <span className="day-number-icone">🔍</span>}
        </div>
        {feriado && (
          <div className="dia-feriado-badge" title={feriado}>
            🎉 {feriado}
          </div>
        )}
        <div className="day-escalas">
          {escalasParaExibir.map(escala => {
            const tecnico = (usuarios || []).find(u => u.uid === escala.tecnicos[0])
            const emCurso = escala.tipo === 'presencial' && estaEmDiaCurso(tecnico, dataAtual)
            const tipo = emCurso ? TIPO_CURSO : TIPOS_ESCALA.find(t => t.id === escala.tipo)
            const nomeTecnico = getNomeTecnico(escala.tecnicos[0])
            return (
              <div
                key={escala.id}
                className="escala-badge-beautiful"
                style={{ backgroundColor: tipo?.cor }}
                onClick={(e) => { e.stopPropagation(); onEditarEscala(escala) }}
                title={`${nomeTecnico}${podeEditarEscala(escala) ? ' — clique para editar' : ''}`}
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

  const renderCalendario = () => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const ano = currentMonth.getFullYear()
    const mes = currentMonth.getMonth()
    const days: ReactNode[] = []

    // Cauda do mês anterior, preenchendo o início da primeira semana — com
    // a escala de verdade (e info do feriado) em vez de uma célula vazia,
    // pra não precisar voltar o calendário só pra conferir esses dias.
    const diasInMesAnterior = getDaysInMonth(new Date(ano, mes - 1, 1))
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(renderDia(new Date(ano, mes - 1, diasInMesAnterior - i), true))
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(renderDia(new Date(ano, mes, day), false))
    }

    // Início do mês seguinte, completando a última semana pelo mesmo motivo.
    const diasRestantes = (7 - ((firstDay + daysInMonth) % 7)) % 7
    for (let day = 1; day <= diasRestantes; day++) {
      days.push(renderDia(new Date(ano, mes + 1, day), true))
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
              if (valor !== '' && !/^\d{0,4}$/.test(valor)) return
              setAnoInput(valor)
              // Só troca de fato o calendário com o ano completo (4 dígitos) —
              // trocar a cada dígito digitado atropela a digitação (e o
              // Date() do JS trata ano de 1-2 dígitos como 19XX, o que
              // bagunça tudo no meio da digitação).
              if (valor.length === 4) {
                const ano = parseInt(valor, 10)
                if (!isNaN(ano)) onMonthChange(new Date(ano, currentMonth.getMonth()))
              }
            }}
            onBlur={() => {
              setAnoInput(currentMonth.getFullYear().toString())
            }}
            onFocus={(e) => e.target.select()}
            className="ano-input"
            placeholder="Ano"
            maxLength={4}
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
