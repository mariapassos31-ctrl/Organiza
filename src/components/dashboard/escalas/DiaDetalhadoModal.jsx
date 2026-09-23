'use client'

import { EQUIPES, nuncaEhEscalado } from '../../../lib/equipesConfig'
import { TIPOS_ESCALA, TIPO_CURSO, estaEmDiaCurso, ehJovemAprendiz } from '../../../lib/escalasConstants'
import { ehFeriado } from '../../../lib/feriados'
import MapaBaias from './MapaBaias'

// Decide quem senta em qual baia no dia.
// - Quem tem "ehSupervisor" senta na baia marcada como "⭐ Supervisor" na
//   tela de Configurar Baias (só uma baia pode ter essa marcação por vez).
//   Ou é gestor com baia fixa (ex: líder do setor, que só tem o role de
//   gestor pra ter visão de gestão, mas continua com lugar fixo) — nesses
//   casos nunca é escalado (não entra no rodízio): por padrão ocupa a
//   própria baia todo dia, a menos que exista uma escala de home office
//   explícita pra ele nesse dia.
// - As demais baias fixas (ex: Yasmim, Igor) participam do rodízio normal:
//   só ocupam a própria baia quando de fato têm escala presencial (ou de
//   sábado) no dia.
// - Quem não tem baia fixa só ocupa se tiver escala presencial/sábado no
//   dia; sem lugar próprio (ou com o lugar já tomado), pega qualquer baia
//   livre — inclusive a de alguém fixo que esteja de folga/home naquele dia.
// - Baias podem ser reservadas a um perfil específico (configurável na tela
//   de Usuários — não é mais fixo em código, e vale pra qualquer perfil, não
//   só Estag/Aprendiz). Uma baia reservada é exclusiva de quem tem aquele
//   perfil — ninguém de outro perfil senta nela, mesmo que sobre baia livre;
//   e quem tem um perfil com baia(s) reservada(s) só senta nelas, nunca
//   flutua pras baias comuns. Baias reservadas a perfil Estag/Aprendiz ou
//   Trainee têm tratamento especial: como tem gente de manhã e de tarde,
//   cada uma comporta até 2 pessoas por dia (uma de cada turno). Quem tem
//   baia fixa nelas usa a própria; os demais flutuantes desse perfil
//   preenchem o turno vago.
// - Estag/Aprendiz ou Trainee no próprio dia de curso não ocupa baia
//   nenhuma (está no curso).

// 8h é manhã, 14h é tarde — qualquer horário antes do meio-dia conta como
// manhã, meio-dia em diante conta como tarde.
function turnoDoHorario(horarioEntrada) {
  if (!horarioEntrada) return null
  const hora = Number(String(horarioEntrada).slice(0, 2))
  if (Number.isNaN(hora)) return null
  return hora < 12 ? 'Manhã' : 'Tarde'
}

// Monta { [baia]: [{nome, turno}] } com quem de Estag/Aprendiz ou Trainee
// está presencial/sábado hoje (e não está no próprio dia de curso), só nas
// baias reservadas ao respectivo perfil.
function calcularOcupantesJovemAprendiz(tecnicosSuporte, uidsPresencialHoje, uidsEmCursoHoje, baiasPerfil) {
  const baiasJovem = Object.keys(baiasPerfil).filter(b => ehJovemAprendiz(baiasPerfil[b]))
  const ocupantesJovem = {}
  for (const baia of baiasJovem) ocupantesJovem[baia] = []
  if (baiasJovem.length === 0) return ocupantesJovem

  const baiasDoPerfil = (perfil) => baiasJovem.filter(b => baiasPerfil[b] === perfil)

  const pessoasHoje = tecnicosSuporte.filter(u =>
    ehJovemAprendiz(u.role) && uidsPresencialHoje.has(u.uid) && !uidsEmCursoHoje.has(u.uid)
  )

  // Primeiro quem tem baia fixa numa das baias do próprio perfil — garante o próprio lugar.
  const comBaiaFixa = pessoasHoje.filter(u => u.baiaFixa && baiasDoPerfil(u.role).includes(u.baia))
  const semBaiaFixa = pessoasHoje.filter(u => !(u.baiaFixa && baiasDoPerfil(u.role).includes(u.baia)))

  for (const u of comBaiaFixa) {
    ocupantesJovem[u.baia].push({ nome: u.nome, turno: turnoDoHorario(u.horarioEntrada) })
  }

  // Os demais preenchem o turno vago de qualquer baia reservada ao próprio perfil.
  for (const u of semBaiaFixa) {
    const turno = turnoDoHorario(u.horarioEntrada)
    const baiaComVaga = baiasDoPerfil(u.role).find(baia =>
      ocupantesJovem[baia].length < 2 && !ocupantesJovem[baia].some(o => o.turno === turno && turno)
    )
    if (baiaComVaga) {
      ocupantesJovem[baiaComVaga].push({ nome: u.nome, turno })
    }
  }

  return ocupantesJovem
}

function calcularOcupacaoBaias(escalasSuporte, tecnicosSuporte, data, baiasPerfil) {
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
  const baiasReservadas = Object.keys(baiasPerfil)

  // Gestor/Supervisor só "aparecem por padrão" em dia de semana normal —
  // eles não trabalham sábado nem feriado, então nesses dias só quem tem
  // escala de sábado de verdade ocupa baia.
  const naoTrabalhaHoje = data.getDay() === 6 || ehFeriado(formatarDataISO(data))

  // A baia do Supervisor não vem do cadastro dele — vem de qual baia (do
  // mapa, incluindo a mesa "0") está marcada como "⭐ Supervisor" na config
  // da equipe. Só uma baia por vez pode ter essa marcação.
  const baiaSupervisor = Object.keys(baiasPerfil).find(b => baiasPerfil[b] === 'supervisor') || null
  const supervisor = tecnicosSuporte.find(u => u.ehSupervisor)
  const supervisorPresenteHoje = supervisor && baiaSupervisor && !naoTrabalhaHoje && !uidsHomeOfficeHoje.has(supervisor.uid)
  if (supervisorPresenteHoje) {
    ocupantes[baiaSupervisor] = supervisor.nome
  }

  // Gestor com baia fixa nunca tem registro de escala (não é escalado) —
  // por padrão ocupa a própria baia todo dia de semana, igual ao Supervisor.
  const naoEscalavel = u => u.ehSupervisor || nuncaEhEscalado(u.role)
  const gestoresFixos = tecnicosSuporte.filter(u => nuncaEhEscalado(u.role) && !u.ehSupervisor && u.baiaFixa && u.baia)
  if (!naoTrabalhaHoje) {
    for (const gestor of gestoresFixos) {
      if (!uidsHomeOfficeHoje.has(gestor.uid) && !ocupantes[gestor.baia]) {
        ocupantes[gestor.baia] = gestor.nome
      }
    }
  }

  // Estag/Aprendiz e Trainee nunca passam por aqui — têm sistema próprio
  // (calculado abaixo), então ficam de fora do rodízio das demais baias.
  // Quem tem um perfil com baia(s) reservada(s) só senta nelas — não pode
  // fixar em outra baia, mesmo com "baia fixa" configurada errado.
  const outrosFixos = tecnicosSuporte.filter(u =>
    u.baiaFixa && u.baia && !naoEscalavel(u) && !ehJovemAprendiz(u.role) &&
    (!baiasPerfil[u.baia] || baiasPerfil[u.baia] === u.role)
  )
  for (const fixo of outrosFixos) {
    if (uidsPresencialHoje.has(fixo.uid) && !uidsEmCursoHoje.has(fixo.uid)) {
      ocupantes[fixo.baia] = fixo.nome
    }
  }

  const presenciaisNaoFixos = escalasSuporte
    .filter(e => e.tipo === 'presencial' || e.tipo === 'sabado')
    .map(e => tecnicosSuporte.find(u => u.uid === e.tecnicos[0]))
    .filter(u => u && !u.baiaFixa && !uidsEmCursoHoje.has(u.uid) && !ehJovemAprendiz(u.role))

  const semLugar = []
  for (const usuario of presenciaisNaoFixos) {
    if (usuario.baia && !baiasReservadas.includes(usuario.baia) && !ocupantes[usuario.baia]) {
      ocupantes[usuario.baia] = usuario.nome
    } else {
      semLugar.push(usuario)
    }
  }

  // Quem tem um perfil com baia reservada só flutua entre as baias do
  // próprio perfil; os demais, em qualquer baia livre que não seja
  // reservada a outro perfil.
  const livrePara = (perfilUsuario) => {
    const baiasDoPerfil = baiasReservadas.filter(b => baiasPerfil[b] === perfilUsuario)
    if (baiasDoPerfil.length > 0) {
      return baiasDoPerfil.find(n => !ocupantes[n])
    }
    return Array.from({ length: 9 }, (_, i) => String(i + 1)).find(n => !ocupantes[n] && !baiasReservadas.includes(n))
  }

  for (const usuario of semLugar) {
    const vaga = livrePara(usuario.role)
    if (vaga) ocupantes[vaga] = usuario.nome
  }

  const ocupantesAprendiz = calcularOcupantesJovemAprendiz(tecnicosSuporte, uidsPresencialHoje, uidsEmCursoHoje, baiasPerfil)
  const baiasJovemAprendiz = {}
  for (const b of baiasReservadas) {
    if (ehJovemAprendiz(baiasPerfil[b])) baiasJovemAprendiz[b] = baiasPerfil[b]
  }

  return { ocupantes, ocupantesAprendiz, baiasJovemAprendiz, baiaSupervisor }
}

function formatarDataISO(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export default function DiaDetalhadoModal({ diaDetalhado, onClose, onNavegarDia, podeEditarEscala, onEditarEscala, getNomeTecnico, usuarios, baiasPerfil = {}, laboratorioConfig }) {
  if (!diaDetalhado) return null

  const escalasSuporte = diaDetalhado.escalas.filter(e => e.equipe === 'suporte')
  const mostrarMapa = escalasSuporte.length > 0

  const tecnicosSuporte = mostrarMapa ? (usuarios || []).filter(u => u.equipe === 'suporte') : []
  const { ocupantes: ocupantesPorBaia, ocupantesAprendiz, baiasJovemAprendiz, baiaSupervisor } = mostrarMapa
    ? calcularOcupacaoBaias(escalasSuporte, tecnicosSuporte, diaDetalhado.data, baiasPerfil)
    : { ocupantes: {}, ocupantesAprendiz: {}, baiasJovemAprendiz: {}, baiaSupervisor: null }

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

  // Quem está no Laboratório hoje: o responsável fixo, a menos que ele
  // esteja de home office ou de férias — nesses dias quem cobre é o
  // backup. Não depende de baia nenhuma, é derivado direto da escala dele.
  const nomeDoUid = (uid) => tecnicosSuporte.find(u => u.uid === uid)?.nome || null
  const estaDeFeriasHoje = (uid) => {
    const u = tecnicosSuporte.find(x => x.uid === uid)
    return Boolean(u?.feriasInicio && u?.feriasFim && u.feriasInicio <= dataISO && dataISO <= u.feriasFim)
  }
  const responsavelUid = laboratorioConfig?.responsavelUid
  const responsavelAusenteHoje = mostrarMapa && responsavelUid &&
    (new Set(escalasSuporte.filter(e => e.tipo === 'homeoffice').map(e => e.tecnicos[0])).has(responsavelUid) ||
      estaDeFeriasHoje(responsavelUid))
  const nomeNoLaboratorio = mostrarMapa && responsavelUid
    ? (responsavelAusenteHoje ? nomeDoUid(laboratorioConfig.backupUid) : nomeDoUid(responsavelUid))
    : null

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
              {nomeNoLaboratorio && (
                <div className="mapa-baias-legenda-coluna">
                  <strong>🧪 No Laboratório</strong>
                  <span>{nomeNoLaboratorio}</span>
                </div>
              )}
            </div>
            <MapaBaias ocupantes={ocupantesPorBaia} ocupantesAprendiz={ocupantesAprendiz} baiasJovemAprendiz={baiasJovemAprendiz} baiaSupervisor={baiaSupervisor} />
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
