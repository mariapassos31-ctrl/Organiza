'use client'

import { EQUIPES } from '../../../lib/equipesConfig'
import { TIPOS_ESCALA, TIPO_CURSO, estaEmDiaCurso } from '../../../lib/escalasConstants'
import { ehFeriado } from '../../../lib/feriados'
import MapaBaias from './MapaBaias'

// Decide quem senta em qual baia no dia.
// - Quem tem "ehSupervisor", ou é gestor com baia fixa (ex: líder do setor,
//   que só tem o role de gestor pra ter visão de gestão, mas continua com
//   lugar fixo), nunca é escalado (não entra no rodízio) — por padrão ocupa
//   a própria baia todo dia, a menos que exista uma escala de home office
//   explícita pra ele nesse dia.
// - As demais baias fixas (ex: Yasmim, Igor) participam do rodízio normal:
//   só ocupam a própria baia quando de fato têm escala presencial (ou de
//   sábado) no dia.
// - Quem não tem baia fixa só ocupa se tiver escala presencial/sábado no
//   dia; sem lugar próprio (ou com o lugar já tomado), pega qualquer baia
//   livre — inclusive a de alguém fixo que esteja de folga/home naquele dia.
// - Entre quem está sem lugar, Aprendiz/Estagiário tem preferência pelas
//   mesas 7 e 8 (reservadas pra essa turma); os demais só caem lá se não
//   sobrar outra baia livre.
// - Aprendiz no próprio dia de curso não ocupa baia nenhuma (está no curso).
const BAIAS_PREFERENCIAIS_APRENDIZ = ['7', '8']

function calcularOcupacaoBaias(escalasSuporte, tecnicosSuporte, data) {
  const uidsHomeOfficeHoje = new Set(
    escalasSuporte.filter(e => e.tipo === 'homeoffice').map(e => e.tecnicos[0])
  )
  // Sábado ocupa a baia igual presencial (é gente fisicamente na sala).
  const uidsPresencialHoje = new Set(
    escalasSuporte.filter(e => e.tipo === 'presencial' || e.tipo === 'sabado').map(e => e.tecnicos[0])
  )
  const uidsEmCursoHoje = new Set(
    tecnicosSuporte.filter(u => estaEmDiaCurso(u, data)).map(u => u.uid)
  )

  const ocupantes = {}

  // Gestor/Supervisor só "aparecem por padrão" em dia de semana normal —
  // eles não trabalham sábado nem feriado, então nesses dias só quem tem
  // escala de sábado de verdade ocupa baia.
  const naoTrabalhaHoje = data.getDay() === 6 || ehFeriado(formatarDataISO(data))

  const supervisor = tecnicosSuporte.find(u => u.ehSupervisor && u.baia)
  const supervisorPresenteHoje = supervisor && !naoTrabalhaHoje && !uidsHomeOfficeHoje.has(supervisor.uid)
  if (supervisorPresenteHoje) {
    ocupantes[supervisor.baia] = supervisor.nome
  }

  // Gestor com baia fixa nunca tem registro de escala (não é escalado) —
  // por padrão ocupa a própria baia todo dia de semana, igual ao Supervisor.
  const naoEscalavel = u => u.ehSupervisor || u.role === 'gestor'
  const gestoresFixos = tecnicosSuporte.filter(u => u.role === 'gestor' && !u.ehSupervisor && u.baiaFixa && u.baia)
  if (!naoTrabalhaHoje) {
    for (const gestor of gestoresFixos) {
      if (!uidsHomeOfficeHoje.has(gestor.uid)) {
        ocupantes[gestor.baia] = gestor.nome
      }
    }
  }

  const outrosFixos = tecnicosSuporte.filter(u => u.baiaFixa && u.baia && !naoEscalavel(u))
  for (const fixo of outrosFixos) {
    if (uidsPresencialHoje.has(fixo.uid) && !uidsEmCursoHoje.has(fixo.uid)) {
      ocupantes[fixo.baia] = fixo.nome
    }
  }

  const presenciaisNaoFixos = escalasSuporte
    .filter(e => e.tipo === 'presencial' || e.tipo === 'sabado')
    .map(e => tecnicosSuporte.find(u => u.uid === e.tecnicos[0]))
    .filter(u => u && !u.baiaFixa && !uidsEmCursoHoje.has(u.uid))

  const semLugar = []
  for (const usuario of presenciaisNaoFixos) {
    if (usuario.baia && !ocupantes[usuario.baia]) {
      ocupantes[usuario.baia] = usuario.nome
    } else {
      semLugar.push(usuario)
    }
  }

  const livre = (evitar = []) =>
    Array.from({ length: 9 }, (_, i) => String(i + 1)).find(n => !ocupantes[n] && !evitar.includes(n))

  const semLugarAprendiz = semLugar.filter(u => u.ehAprendiz)
  const semLugarOutros = semLugar.filter(u => !u.ehAprendiz)

  for (const usuario of semLugarAprendiz) {
    const vaga = BAIAS_PREFERENCIAIS_APRENDIZ.find(n => !ocupantes[n]) || livre()
    if (vaga) ocupantes[vaga] = usuario.nome
  }
  for (const usuario of semLugarOutros) {
    const vaga = livre(BAIAS_PREFERENCIAIS_APRENDIZ) || livre()
    if (vaga) ocupantes[vaga] = usuario.nome
  }

  return { ocupantes, nomeSupervisor: supervisorPresenteHoje ? supervisor.nome : null }
}

function formatarDataISO(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export default function DiaDetalhadoModal({ diaDetalhado, onClose, onNavegarDia, podeEditarEscala, onEditarEscala, getNomeTecnico, usuarios }) {
  if (!diaDetalhado) return null

  const escalasSuporte = diaDetalhado.escalas.filter(e => e.equipe === 'suporte')
  const mostrarMapa = escalasSuporte.length > 0

  const tecnicosSuporte = mostrarMapa ? (usuarios || []).filter(u => u.equipe === 'suporte') : []
  const { ocupantes: ocupantesPorBaia, nomeSupervisor } = mostrarMapa
    ? calcularOcupacaoBaias(escalasSuporte, tecnicosSuporte, diaDetalhado.data)
    : { ocupantes: {}, nomeSupervisor: null }

  const dataISO = mostrarMapa ? formatarDataISO(diaDetalhado.data) : null
  const nomesEmHomeOffice = mostrarMapa
    ? escalasSuporte
        .filter(e => e.tipo === 'homeoffice')
        .map(e => tecnicosSuporte.find(u => u.uid === e.tecnicos[0])?.nome)
        .filter(Boolean)
    : []
  const nomesDeFerias = mostrarMapa
    ? tecnicosSuporte
        .filter(u => u.feriasInicio && u.feriasFim && u.feriasInicio <= dataISO && dataISO <= u.feriasFim)
        .map(u => u.nome)
    : []
  const nomesEmCurso = mostrarMapa
    ? tecnicosSuporte.filter(u => estaEmDiaCurso(u, diaDetalhado.data)).map(u => u.nome)
    : []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${mostrarMapa ? 'modal-content-largo' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📅 Escalados em {diaDetalhado.data.toLocaleDateString('pt-BR')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {onNavegarDia && (
          <div className="dia-detalhado-navegacao">
            <button type="button" className="btn-secondary" onClick={() => onNavegarDia(-1)}>← Dia anterior</button>
            <button type="button" className="btn-secondary" onClick={() => onNavegarDia(1)}>Próximo dia →</button>
          </div>
        )}

        {mostrarMapa && (
          <div style={{ padding: '0 20px' }}>
            <div className="mapa-baias-legendas">
              <div className="mapa-baias-legenda-coluna">
                <strong>🏠 Em home office</strong>
                <span>{nomesEmHomeOffice.length > 0 ? nomesEmHomeOffice.join(', ') : 'Ninguém'}</span>
              </div>
              <div className="mapa-baias-legenda-coluna">
                <strong>🌴 De férias</strong>
                <span>{nomesDeFerias.length > 0 ? nomesDeFerias.join(', ') : 'Ninguém'}</span>
              </div>
              {nomesEmCurso.length > 0 && (
                <div className="mapa-baias-legenda-coluna">
                  <strong>🎓 Em curso</strong>
                  <span>{nomesEmCurso.join(', ')}</span>
                </div>
              )}
            </div>
            <MapaBaias ocupantes={ocupantesPorBaia} nomeSupervisor={nomeSupervisor} />
          </div>
        )}

        <div className="dia-detalhado-lista">
          {diaDetalhado.escalas.map(escala => {
            const tecnico = (usuarios || []).find(u => u.uid === escala.tecnicos[0])
            const emCurso = escala.tipo === 'presencial' && estaEmDiaCurso(tecnico, diaDetalhado.data)
            const tipo = emCurso ? TIPO_CURSO : TIPOS_ESCALA.find(t => t.id === escala.tipo)
            const equipe = EQUIPES.find(e => e.id === escala.equipe)
            return (
              <div
                key={escala.id}
                className="dia-detalhado-item"
                onClick={() => { onClose(); onEditarEscala(escala) }}
                title={podeEditarEscala(escala) ? 'Clique para editar' : 'Clique para ver detalhes'}
              >
                <span className="dia-detalhado-tipo" style={{ backgroundColor: tipo?.cor }}>{tipo?.label}</span>
                <span className="dia-detalhado-tecnico">{getNomeTecnico(escala.tecnicos[0])}</span>
                <span className="dia-detalhado-equipe">{equipe?.label || escala.equipe}</span>
              </div>
            )
          })}
        </div>
        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
