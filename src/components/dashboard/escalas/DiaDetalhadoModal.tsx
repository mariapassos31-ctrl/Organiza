'use client'

import { EQUIPES, nuncaEhEscalado } from '../../../lib/equipesConfig'
import { TIPOS_ESCALA, TIPO_CURSO, estaEmDiaCurso, ehJovemAprendiz } from '../../../lib/escalasConstants'
import { ehFeriado } from '../../../lib/feriados'
import { calcularOcupacaoBaias, formatarDataISO } from '../../../lib/ocupacaoBaias'
import MapaBaias, { criarExibidorDeNome } from './MapaBaias'
import { emojiDoMarcador } from './EditorPosicoesSala'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'
import type { Escala, Usuario, Sala, ConfigLab, DiaDetalhado, OcupanteAprendiz } from '../../../types/dominio'

// Ocupação de uma sala com reserva por equipe (Sala Compartilhada comum,
// ou uma sala de um grupo "Entre Salas"): um técnico só ocupa uma baia
// reservada à PRÓPRIA equipe, nunca a de outra. A especialidade que
// eventualmente restrinja uma baia ali é só informativa na config — não
// entra nessa conta, porque especialidade é um campo sensível (só visível
// pro gestor da MESMA equipe do técnico) e aqui um gestor precisa ver o
// dia inteiro, com gente de equipes diferentes.
//
// Uma equipe pode estar vinculada a mais de uma sala ao mesmo tempo (não
// só num grupo "Entre Salas" formal — pode ser qualquer configuração) —
// nesse caso a equipe sozinha não diz em qual sala a pessoa está, só a
// sala marcada na própria escala (escolhida na hora de escalar, manual
// ou pelo rodízio entre salas). Quem ainda não tem sala definida não
// aparece em nenhuma (fica só o aviso), pra não contar a mesma pessoa em
// duas salas ao mesmo tempo. Equipe vinculada a uma única sala continua
// descoberta sozinha, como sempre.
function calcularOcupacaoSalaEquipe(
  escalasDoDia: Escala[],
  usuarios: Usuario[] | undefined,
  sala: Sala,
  todasAsSalas: Sala[]
): { ocupantes: Record<string, string>; semSalaDefinida: number; temEscalasHoje: boolean; nomesHomeOffice: string[]; nomesSobreaviso: string[] } {
  const baiasReservadas = Object.keys(sala.baias)
  const tecnicosEnvolvidos = (usuarios || []).filter(u => sala.equipes.includes(u.equipe ?? ''))

  const equipeAmbigua = (equipe: string | null | undefined) =>
    todasAsSalas.filter(s => s.equipes.includes(equipe ?? '')).length > 1

  const escalasCandidatas = escalasDoDia.filter(e =>
    sala.equipes.includes(e.equipe ?? '') && (e.tipo === 'presencial' || e.tipo === 'sabado')
  )
  const escalasDaSala = escalasCandidatas.filter(e => !equipeAmbigua(e.equipe) || e.salaId === sala.id)
  const semSalaDefinida = escalasCandidatas.filter(e => equipeAmbigua(e.equipe) && e.salaId == null).length

  // Home office não ocupa baia nenhuma, mas a sala da equipe continua
  // aparecendo no dia mesmo assim (igual já acontecia pro Suporte) — só
  // pra mostrar que a sala existe e quem tá em casa hoje. Quando a equipe
  // está em 2+ salas, só conta o home office que tem ESSA sala marcada
  // (a geração já grava isso) — senão o home office gerado por uma sala
  // vazava pra dentro da visão de outra sala da mesma equipe.
  const homeOfficeCandidatos = escalasDoDia.filter(e => sala.equipes.includes(e.equipe ?? '') && e.tipo === 'homeoffice')
  const nomesHomeOffice = homeOfficeCandidatos
    .filter(e => !equipeAmbigua(e.equipe) || e.salaId === sala.id)
    .map(e => tecnicosEnvolvidos.find(u => u.uid === e.tecnicos[0])?.nome)
    .filter((n): n is string => Boolean(n))
  // Sobreaviso é visto por todo mundo (não é "da" sala) — já é filtrado
  // globalmente lá em cima no modal; aqui só entra na contagem de
  // "essa sala teve algo hoje" pra ela não sumir da lista.
  const nomesSobreaviso = escalasDoDia
    .filter(e => sala.equipes.includes(e.equipe ?? '') && e.tipo === 'sobreaviso')
    .map(e => tecnicosEnvolvidos.find(u => u.uid === e.tecnicos[0])?.nome)
    .filter((n): n is string => Boolean(n))
  const temEscalasHoje = escalasCandidatas.length > 0 || nomesHomeOffice.length > 0 || nomesSobreaviso.length > 0

  if (baiasReservadas.length === 0) {
    return { ocupantes: {}, semSalaDefinida, temEscalasHoje, nomesHomeOffice, nomesSobreaviso }
  }

  const uidsPresencialHoje = new Set(escalasDaSala.map(e => e.tecnicos[0]))

  const ocupantes: Record<string, string> = {}
  const baiaDaPropriaEquipe = (baia: string, usuario: Usuario) => sala.baias[baia]?.equipe === usuario.equipe

  const fixos = tecnicosEnvolvidos.filter(u => u.baiaFixa && u.baia && baiasReservadas.includes(u.baia) && baiaDaPropriaEquipe(u.baia, u))
  // Duas pessoas com a MESMA baia fixa cadastrada (erro de cadastro) não
  // podem fazer a segunda sumir do mapa — só quem chega primeiro garante a
  // baia; o resto flutua e ainda ganha uma vaga livre, em vez de sumir.
  const uidsQueGanharamBaiaFixa = new Set<string>()
  for (const fixo of fixos) {
    if (uidsPresencialHoje.has(fixo.uid) && !ocupantes[fixo.baia]) {
      ocupantes[fixo.baia] = fixo.nome
      uidsQueGanharamBaiaFixa.add(fixo.uid)
    }
  }

  const presenciaisNaoFixos = tecnicosEnvolvidos.filter(u =>
    uidsPresencialHoje.has(u.uid) && !uidsQueGanharamBaiaFixa.has(u.uid)
  )

  const livrePara = (usuario: Usuario) => baiasReservadas.find(b => !ocupantes[b] && baiaDaPropriaEquipe(b, usuario))

  for (const usuario of presenciaisNaoFixos) {
    const vaga = livrePara(usuario)
    if (vaga) ocupantes[vaga] = usuario.nome
  }

  return { ocupantes, semSalaDefinida, temEscalasHoje, nomesHomeOffice, nomesSobreaviso }
}

// Ocupação de uma sala de 1 equipe só (reserva por perfil), fora a sala
// fixa do Suporte (que tem regras próprias — Jovem Aprendiz dividindo
// turno, Supervisor, baia extra por último recurso — calculadas à parte
// em calcularOcupacaoBaias). Aqui é o caso genérico: usa todas as baias
// da sala (1..qtdBaias), não só as que tiverem reserva de perfil — uma
// sala sem nenhuma reserva configurada deixa qualquer um da equipe sentar
// em qualquer baia livre, em vez de aparecer tudo vazio. Baia fixa tem
// prioridade, os demais flutuam pra uma baia livre do próprio perfil (ou
// sem restrição nenhuma). Mesma equipe em 2+ salas só conta quem já tem
// essa sala marcada na escala, igual ao modo por equipe.
function calcularOcupacaoSalaPerfil(
  escalasDoDia: Escala[],
  usuarios: Usuario[] | undefined,
  sala: Sala,
  todasAsSalas: Sala[]
): { ocupantes: Record<string, string>; semSalaDefinida: number; temEscalasHoje: boolean; nomesHomeOffice: string[]; nomesSobreaviso: string[] } {
  const equipeDaSala = sala.equipes[0]
  const numerosBaia = Array.from({ length: sala.qtdBaias || 9 }, (_, i) => String(i + 1))
  const tecnicosEnvolvidos = (usuarios || []).filter(u => u.equipe === equipeDaSala)

  const equipeAmbigua = todasAsSalas.filter(s => s.equipes.includes(equipeDaSala)).length > 1

  const escalasCandidatas = escalasDoDia.filter(e => e.equipe === equipeDaSala && (e.tipo === 'presencial' || e.tipo === 'sabado'))
  const escalasDaSala = escalasCandidatas.filter(e => !equipeAmbigua || e.salaId === sala.id)
  const semSalaDefinida = equipeAmbigua ? escalasCandidatas.filter(e => e.salaId == null).length : 0

  // Mesma lógica do modo por equipe: home office não ocupa baia, mas a
  // sala continua aparecendo no dia (mostra a planta + quem tá em casa).
  // Se a equipe está em 2+ salas, só conta o home office com ESSA sala
  // marcada — senão o de uma sala vazava pra visão da outra.
  const nomesHomeOffice = escalasDoDia
    .filter(e => e.equipe === equipeDaSala && e.tipo === 'homeoffice' && (!equipeAmbigua || e.salaId === sala.id))
    .map(e => tecnicosEnvolvidos.find(u => u.uid === e.tecnicos[0])?.nome)
    .filter((n): n is string => Boolean(n))
  const nomesSobreaviso = escalasDoDia
    .filter(e => e.equipe === equipeDaSala && e.tipo === 'sobreaviso')
    .map(e => tecnicosEnvolvidos.find(u => u.uid === e.tecnicos[0])?.nome)
    .filter((n): n is string => Boolean(n))
  const temEscalasHoje = escalasCandidatas.length > 0 || nomesHomeOffice.length > 0 || nomesSobreaviso.length > 0

  const uidsPresencialHoje = new Set(escalasDaSala.map(e => e.tecnicos[0]))
  const ocupantes: Record<string, string> = {}
  const baiaCombinaComPerfil = (baia: string, usuario: Usuario) => !sala.baias[baia]?.perfil || sala.baias[baia].perfil === usuario.role

  const fixos = tecnicosEnvolvidos.filter(u => u.baiaFixa && u.baia && numerosBaia.includes(u.baia) && baiaCombinaComPerfil(u.baia, u))
  // Duas pessoas com a MESMA baia fixa cadastrada (erro de cadastro) não
  // podem fazer a segunda sumir do mapa — só quem chega primeiro garante a
  // baia; o resto flutua e ainda ganha uma vaga livre, em vez de sumir.
  const uidsQueGanharamBaiaFixa = new Set<string>()
  for (const fixo of fixos) {
    if (uidsPresencialHoje.has(fixo.uid) && !ocupantes[fixo.baia]) {
      ocupantes[fixo.baia] = fixo.nome
      uidsQueGanharamBaiaFixa.add(fixo.uid)
    }
  }

  const presenciaisNaoFixos = tecnicosEnvolvidos.filter(u =>
    uidsPresencialHoje.has(u.uid) && !uidsQueGanharamBaiaFixa.has(u.uid)
  )

  const livrePara = (usuario: Usuario) => {
    const doPerfil = numerosBaia.filter(b => sala.baias[b]?.perfil === usuario.role)
    const vagaDoPerfil = doPerfil.find(b => !ocupantes[b])
    if (vagaDoPerfil) return vagaDoPerfil
    return numerosBaia.find(b => !ocupantes[b] && !sala.baias[b]?.perfil)
  }

  for (const usuario of presenciaisNaoFixos) {
    const vaga = livrePara(usuario)
    if (vaga) ocupantes[vaga] = usuario.nome
  }

  return { ocupantes, semSalaDefinida, temEscalasHoje, nomesHomeOffice, nomesSobreaviso }
}

export default function DiaDetalhadoModal({ diaDetalhado, onClose, onNavegarDia, podeEditarEscala, onEditarEscala, getNomeTecnico, usuarios, baiasPerfil = {}, laboratorioConfig, externoConfig, salas = [], todasAsSalas }: {
  diaDetalhado: DiaDetalhado | null
  onClose: () => void
  onNavegarDia?: (delta: number) => void
  podeEditarEscala: (escala: Escala) => boolean
  onEditarEscala: (escala: Escala) => void
  getNomeTecnico: (uid: string) => string
  usuarios?: Usuario[]
  baiasPerfil?: Record<string, string>
  laboratorioConfig?: ConfigLab
  externoConfig?: ConfigLab
  salas?: Sala[]
  // Lista completa de salas (não só as sendo mostradas agora) — usada só
  // pra saber se a equipe de alguém está espalhada em mais de uma sala,
  // mesmo quando a tela está focada numa única sala. Sem essa lista
  // separada, uma visão focada nunca detectaria ambiguidade nenhuma.
  todasAsSalas?: Sala[]
}) {
  if (!diaDetalhado) return null

  // Sobreaviso e sábado não são "de" uma sala — são informação que toda
  // gestão precisa ver, então aparecem sempre, olhando TODAS as escalas
  // do dia (todas as equipes), iguais não importa qual sala esteja em
  // foco. Home office NÃO entra aqui — cada sala/equipe vê só a sua
  // própria, sem misturar (é tratado à parte, por sala, mais abaixo).
  const nomeGlobalDoUid = (uid: string) => (usuarios || []).find(u => u.uid === uid)?.nome || null
  const nomesGlobaisPorTipo = (tipo: string) => diaDetalhado.escalas
    .filter(e => e.tipo === tipo)
    .map(e => nomeGlobalDoUid(e.tecnicos[0]))
    .filter((n): n is string => Boolean(n))
  const nomesGlobaisSobreaviso = nomesGlobaisPorTipo('sobreaviso')
  const nomesGlobaisSabado = nomesGlobaisPorTipo('sabado')

  // O mapa fixo do Suporte só pode aparecer se a sala com aquela imagem
  // específica estiver de fato entre as salas sendo mostradas agora — só
  // ter escala de alguém da equipe "suporte" não basta, porque uma sala
  // genérica qualquer também pode acabar vinculada à equipe suporte (ex:
  // criada por um gestor de Suporte) sem ser essa sala com posições fixas.
  const salaSuporteFixa = (salas || []).find(s => s.imagem === IMAGEM_COM_POSICOES_CONHECIDAS)
  // Se o Suporte ganhar uma segunda sala de verdade, quem já tem essa
  // outra sala marcada na escala não entra aqui — só quem ainda não tem
  // sala definida continua caindo por padrão nessa (a original), pra
  // ninguém sumir do mapa por causa de escala antiga sem esse campo.
  const escalasSuporte = diaDetalhado.escalas.filter(e =>
    e.equipe === 'suporte' && (!salaSuporteFixa || e.salaId == null || e.salaId === salaSuporteFixa.id)
  )
  const mostrarMapa = Boolean(salaSuporteFixa) && escalasSuporte.length > 0

  const salasCompartilhadas = (salas || []).filter(s => s.modoReserva === 'equipe' || s.modoReserva === 'entre_salas')
  const ocupacaoPorSala = salasCompartilhadas
    .map(sala => ({ sala, ...calcularOcupacaoSalaEquipe(diaDetalhado.escalas, usuarios, sala, todasAsSalas ?? salas ?? []) }))
    .filter(o => o.temEscalasHoje)

  // Sala de 1 equipe só, além da fixa do Suporte — ex: uma segunda sala
  // do próprio Suporte, ou de qualquer outra equipe com sala própria.
  const outrasSalasPerfil = (salas || []).filter(s => s.modoReserva === 'perfil' && s.id !== salaSuporteFixa?.id)
  const ocupacaoPorSalaPerfil = outrasSalasPerfil
    .map(sala => ({ sala, ...calcularOcupacaoSalaPerfil(diaDetalhado.escalas, usuarios, sala, todasAsSalas ?? salas ?? []) }))
    .filter(o => o.temEscalasHoje)

  const blocosDeSala = [...ocupacaoPorSala, ...ocupacaoPorSalaPerfil]

  const tecnicosSuporte = mostrarMapa ? (usuarios || []).filter(u => u.equipe === 'suporte') : []
  const dataISO = mostrarMapa ? formatarDataISO(diaDetalhado.data) : ''
  const nomeDoUid = (uid: string) => tecnicosSuporte.find(u => u.uid === uid)?.nome || null
  const estaDeFeriasHoje = (uid: string) => {
    const u = tecnicosSuporte.find(x => x.uid === uid)
    if (!u) return false
    if (u.feriasInicio && u.feriasFim && u.feriasInicio <= dataISO && dataISO <= u.feriasFim) return true
    return Boolean(u.feriasExtras?.some(p => p.inicio <= dataISO && dataISO <= p.fim))
  }

  // Quem está no Laboratório hoje: o responsável fixo, a menos que ele
  // esteja de home office ou de férias — nesses dias quem cobre é o
  // backup. Não depende de baia nenhuma, é derivado direto da escala dele.
  // Calculado antes do mapa da sala pra excluir essa pessoa de lá: ela
  // está fisicamente no Laboratório, não pode aparecer também numa baia
  // comum no mesmo dia.
  const responsavelUid = laboratorioConfig?.responsavelUid
  const responsavelAusenteHoje = mostrarMapa && responsavelUid &&
    (new Set(escalasSuporte.filter(e => e.tipo === 'homeoffice').map(e => e.tecnicos[0])).has(responsavelUid) ||
      estaDeFeriasHoje(responsavelUid))
  const uidNoLaboratorioHoje = mostrarMapa && responsavelUid
    ? (responsavelAusenteHoje ? (laboratorioConfig?.backupUid ?? null) : responsavelUid)
    : null
  const nomeNoLaboratorio = uidNoLaboratorioHoje ? nomeDoUid(uidNoLaboratorioHoje) : null

  // Mesma lógica do Laboratório, pro Externo: o responsável fixo, a menos
  // que ele esteja de home office ou de férias — nesses dias quem cobre é
  // o backup.
  const responsavelExternoUid = externoConfig?.responsavelUid
  const responsavelExternoAusenteHoje = mostrarMapa && responsavelExternoUid &&
    (new Set(escalasSuporte.filter(e => e.tipo === 'homeoffice').map(e => e.tecnicos[0])).has(responsavelExternoUid) ||
      estaDeFeriasHoje(responsavelExternoUid))
  const uidNoExternoHoje = mostrarMapa && responsavelExternoUid
    ? (responsavelExternoAusenteHoje ? (externoConfig?.backupUid ?? null) : responsavelExternoUid)
    : null
  const nomeNoExterno = uidNoExternoHoje ? nomeDoUid(uidNoExternoHoje) : null

  const { ocupantes: ocupantesPorBaia, ocupantesAprendiz, baiasJovemAprendiz, baiaSupervisor } = mostrarMapa
    ? calcularOcupacaoBaias(escalasSuporte, tecnicosSuporte, diaDetalhado.data, baiasPerfil, uidNoLaboratorioHoje, uidNoExternoHoje)
    : { ocupantes: {}, ocupantesAprendiz: {}, baiasJovemAprendiz: {}, baiaSupervisor: null }

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
      <div className={`modal-content ${(mostrarMapa || blocosDeSala.length > 0) ? 'modal-content-largo' : ''}`} onClick={(e) => e.stopPropagation()}>
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

        {(nomesGlobaisSobreaviso.length > 0 || nomesGlobaisSabado.length > 0) && (
          <div style={{ padding: '0 20px' }}>
            <div className="mapa-baias-legendas">
              {nomesGlobaisSobreaviso.length > 0 && (
                <div className="mapa-baias-legenda-coluna">
                  <strong>🚨 Em sobreaviso</strong>
                  <span>{nomesGlobaisSobreaviso.join(', ')}</span>
                </div>
              )}
              {nomesGlobaisSabado.length > 0 && (
                <div className="mapa-baias-legenda-coluna">
                  <strong>📅 Escala Sábado</strong>
                  <span>{nomesGlobaisSabado.join(', ')}</span>
                </div>
              )}
            </div>
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
              {nomeNoExterno && (
                <div className="mapa-baias-legenda-coluna">
                  <strong>🧳 Externo</strong>
                  <span>{nomeNoExterno}</span>
                </div>
              )}
            </div>
            <MapaBaias ocupantes={ocupantesPorBaia} ocupantesAprendiz={ocupantesAprendiz} baiasJovemAprendiz={baiasJovemAprendiz} baiaSupervisor={baiaSupervisor} />
          </div>
        )}

        {blocosDeSala.map(({ sala, ocupantes, semSalaDefinida, nomesHomeOffice }) => {
          const numerosBaia = Array.from({ length: sala.qtdBaias || 9 }, (_, i) => String(i + 1))
          const temMapaProprio = Boolean(sala.imagem) && numerosBaia.every(n => sala.posicoes?.[n])
          const exibirNome = criarExibidorDeNome(Object.values(ocupantes))
          return (
            <div key={sala.id} style={{ padding: '0 20px' }}>
              <h4 style={{ margin: '0 0 10px' }}>🏢 {sala.nome}</h4>
              {nomesHomeOffice.length > 0 && (
                <p className="campo-nota">🏠 Em home office hoje: {nomesHomeOffice.join(', ')}</p>
              )}
              {semSalaDefinida > 0 && (
                <p className="campo-nota">
                  {semSalaDefinida} pessoa(s) presencial ainda sem sala definida — gere o rodízio entre salas (ou marque manualmente na escala) pra esse período.
                </p>
              )}
              {temMapaProprio ? (
                <div className="mapa-baias-wrapper">
                  <img src={sala.imagem ?? undefined} alt={`Mapa da ${sala.nome}`} className="mapa-baias-imagem" />
                  {numerosBaia.map(baia => (
                    <div key={baia} className="mapa-baias-etiqueta" style={sala.posicoes[baia]}>
                      {ocupantes[baia] ? exibirNome(ocupantes[baia]) : '—'}
                    </div>
                  ))}
                  {sala.marcadores?.map(m => (
                    <div key={m.id} className="editor-marcador-item" style={{ top: m.top, left: m.left }}>
                      <span className="editor-marcador-icone">{emojiDoMarcador(m.tipo)}</span>
                      <span className="editor-marcador-rotulo">{m.rotulo}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="config-baias-lista">
                  {/* Modo por perfil (equipe só) mostra todas as baias da sala,
                     mesmo sem reserva nenhuma — qualquer um da equipe pode
                     estar em qualquer uma. Modo por equipe só mostra as que
                     têm reserva de verdade, porque baia sem reserva ali fica
                     sempre vazia mesmo (ninguém flutua pra ela). */}
                  {(sala.modoReserva === 'perfil' ? numerosBaia : Object.keys(sala.baias)).sort((a, b) => Number(a) - Number(b)).map(baia => (
                    <div key={baia} className="config-baia-linha">
                      <span className="config-baia-linha-numero">Baia {baia}</span>
                      <span>{ocupantes[baia] || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

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
