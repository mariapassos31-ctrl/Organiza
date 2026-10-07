import { nuncaEhEscalado } from './equipesConfig'
import { estaEmDiaCurso, ehJovemAprendiz } from './escalasConstants'
import { ehFeriado } from './feriados'
import type { Escala, Usuario, OcupanteAprendiz } from '../types/dominio'

// Extraído de DiaDetalhadoModal.tsx pra poder ser reaproveitado fora do
// componente (ex: gerar a imagem do mapa preenchido pro e-mail de nova
// escala) — mesma lógica, sem nenhuma mudança de comportamento.

export interface Posicao { top: string; left: string }

// Posições de cada baia (0 a 9, incluindo a mesa do Supervisor) na imagem
// fixa da Sala Suporte (public/images/mapa-baias.png).
export const POSICOES_BAIA: Record<string, Posicao> = {
  0: { top: '6.5%', left: '50%' },
  1: { top: '69.2%', left: '37.6%' },
  2: { top: '69.2%', left: '60.3%' },
  3: { top: '53.7%', left: '73%' },
  4: { top: '35.5%', left: '73%' },
  5: { top: '17.3%', left: '73%' },
  6: { top: '35.5%', left: '54.4%' },
  7: { top: '54.1%', left: '26.7%' },
  8: { top: '35.7%', left: '26.7%' },
  9: { top: '17.3%', left: '26.7%' },
}

// 8h é manhã, 14h é tarde — qualquer horário antes do meio-dia conta como
// manhã, meio-dia em diante conta como tarde.
export function turnoDoHorario(horarioEntrada: string | null | undefined): string | null {
  if (!horarioEntrada) return null
  const hora = Number(String(horarioEntrada).slice(0, 2))
  if (Number.isNaN(hora)) return null
  return hora < 12 ? 'Manhã' : 'Tarde'
}

export function formatarDataISO(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Monta { [baia]: [{nome, turno}] } com quem de Estag/Aprendiz ou Trainee
// está presencial/sábado hoje (e não está no próprio dia de curso), só nas
// baias reservadas ao respectivo perfil. Sem limite de quantas pessoas por
// baia: quem tem escala naquele dia aparece, só fica de fora quem está no
// próprio dia de curso.
export function calcularOcupantesJovemAprendiz(
  tecnicosSuporte: Usuario[],
  uidsPresencialHoje: Set<string>,
  uidsEmCursoHoje: Set<string>,
  baiasPerfil: Record<string, string>
): Record<string, OcupanteAprendiz[]> {
  const baiasJovem = Object.keys(baiasPerfil).filter(b => ehJovemAprendiz(baiasPerfil[b]))
  const ocupantesJovem: Record<string, OcupanteAprendiz[]> = {}
  for (const baia of baiasJovem) ocupantesJovem[baia] = []
  if (baiasJovem.length === 0) return ocupantesJovem

  const baiasDoPerfil = (perfil: string) => baiasJovem.filter(b => baiasPerfil[b] === perfil)

  const pessoasHoje = tecnicosSuporte.filter(u =>
    ehJovemAprendiz(u.role) && uidsPresencialHoje.has(u.uid) && !uidsEmCursoHoje.has(u.uid)
  )

  // Primeiro quem tem baia fixa numa das baias do próprio perfil — garante o próprio lugar.
  const comBaiaFixa = pessoasHoje.filter(u => u.baiaFixa && baiasDoPerfil(u.role).includes(u.baia))
  const semBaiaFixa = pessoasHoje.filter(u => !(u.baiaFixa && baiasDoPerfil(u.role).includes(u.baia)))

  for (const u of comBaiaFixa) {
    ocupantesJovem[u.baia].push({ nome: u.nome, turno: turnoDoHorario(u.horarioEntrada) })
  }

  // Os demais entram numa baia reservada ao próprio perfil — sem limite de
  // quantas pessoas por baia nem exclusividade de turno (Estag/Aprendiz não
  // tem essa restrição: quem tem escala presencial aparece, ponto; só fica
  // de fora quem está no próprio dia de curso, já filtrado em pessoasHoje).
  // Só espalha entre as baias reservadas (a com menos gente primeiro) pra
  // não empilhar tudo numa baia só enquanto a outra fica vazia.
  for (const u of semBaiaFixa) {
    const baias = baiasDoPerfil(u.role)
    if (baias.length === 0) continue
    const baiaComMenosGente = baias.reduce((menor, atual) =>
      ocupantesJovem[atual].length < ocupantesJovem[menor].length ? atual : menor
    )
    ocupantesJovem[baiaComMenosGente].push({ nome: u.nome, turno: turnoDoHorario(u.horarioEntrada) })
  }

  return ocupantesJovem
}

// Decide quem senta em qual baia no dia (Sala Suporte). Ver histórico de
// comentários original em DiaDetalhadoModal.tsx pra todas as regras
// (supervisor, gestor fixo, baia reservada por perfil, Jovem Aprendiz por
// turno, Laboratório/Externo fora do rodízio).
export function calcularOcupacaoBaias(
  escalasSuporte: Escala[],
  tecnicosSuporte: Usuario[],
  data: Date,
  baiasPerfil: Record<string, string>,
  uidNoLaboratorioHoje: string | null,
  uidNoExternoHoje: string | null
) {
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

  const ocupantes: Record<string, string> = {}
  const baiasReservadas = Object.keys(baiasPerfil)

  // Gestor/Supervisor só "aparecem por padrão" em dia de semana normal —
  // eles não trabalham sábado nem feriado, então nesses dias só quem tem
  // escala de sábado de verdade ocupa baia.
  const naoTrabalhaHoje = data.getDay() === 6 || ehFeriado(formatarDataISO(data))
  const naoEscalavel = (u: Usuario) => u.ehSupervisor || nuncaEhEscalado(u.role)

  // A baia do Supervisor não vem do cadastro dele — vem de qual baia (do
  // mapa, incluindo a mesa "0") está marcada como "⭐ Supervisor" na config
  // da equipe. Só uma baia por vez pode ter essa marcação.
  const baiaSupervisor = Object.keys(baiasPerfil).find(b => baiasPerfil[b] === 'supervisor') || null
  const supervisor = tecnicosSuporte.find(u => u.ehSupervisor)
  const supervisorPresenteHoje = supervisor && baiaSupervisor && !naoTrabalhaHoje && !uidsHomeOfficeHoje.has(supervisor.uid)
  if (supervisorPresenteHoje && baiaSupervisor && supervisor) {
    ocupantes[baiaSupervisor] = supervisor.nome
  }

  // Gestor com baia fixa nunca tem registro de escala (não é escalado) —
  // por padrão ocupa a própria baia todo dia de semana, igual ao Supervisor.
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
  // Quem está no Laboratório ou no Externo hoje também não entra aqui —
  // está fisicamente em outro lugar, não numa baia comum.
  //
  // Baia reservada a Estag/Aprendiz, Trainee ou Supervisor é mesmo
  // exclusiva (tem sistema de turno/marcação própria) — ninguém de fora
  // desses perfis pode fixar ali, nem com "baia fixa" configurada errado.
  // Mas baia marcada com um perfil comum (analista/técnico/líder/gestor)
  // é só um rótulo informativo da sala, não uma reserva de verdade — quem
  // escolheu fixar ali deve conseguir, mesmo que o perfil marcado na sala
  // seja outro (ex: baia rotulada "analista" mas o líder fixou ali).
  const baiaEhExclusiva = (perfil: string | undefined) => ehJovemAprendiz(perfil) || perfil === 'supervisor'
  const outrosFixos = tecnicosSuporte.filter(u =>
    u.baiaFixa && u.baia && !naoEscalavel(u) && !ehJovemAprendiz(u.role) &&
    u.uid !== uidNoLaboratorioHoje && u.uid !== uidNoExternoHoje &&
    !baiaEhExclusiva(baiasPerfil[u.baia])
  )
  // Duas pessoas configuradas com a MESMA baia fixa (erro de cadastro) não
  // podem fazer a segunda sumir do mapa inteiro — só a primeira a chegar
  // aqui garante a baia; quem perder vira flutuante e ainda ganha uma vaga
  // livre qualquer, em vez de desaparecer sem rastro.
  const uidsQueGanharamBaiaFixa = new Set<string>()
  for (const fixo of outrosFixos) {
    if (uidsPresencialHoje.has(fixo.uid) && !uidsEmCursoHoje.has(fixo.uid) && !ocupantes[fixo.baia]) {
      ocupantes[fixo.baia] = fixo.nome
      uidsQueGanharamBaiaFixa.add(fixo.uid)
    }
  }

  // "baia fixa" marcada sem nenhuma baia escolhida (ou perdida pra um
  // colega com a mesma baia) não conta como fixo de verdade — trata como
  // flutuante, senão a pessoa não entra em nenhuma das duas listas e some
  // do mapa.
  const presenciaisNaoFixos = escalasSuporte
    .filter(e => e.tipo === 'presencial' || e.tipo === 'sabado')
    .map(e => tecnicosSuporte.find(u => u.uid === e.tecnicos[0]))
    .filter((u): u is Usuario =>
      !!u && !uidsQueGanharamBaiaFixa.has(u.uid) && !uidsEmCursoHoje.has(u.uid) && !ehJovemAprendiz(u.role) &&
      u.uid !== uidNoLaboratorioHoje && u.uid !== uidNoExternoHoje
    )

  const semLugar: Usuario[] = []
  for (const usuario of presenciaisNaoFixos) {
    if (usuario.baia && !baiasReservadas.includes(usuario.baia) && !ocupantes[usuario.baia]) {
      ocupantes[usuario.baia] = usuario.nome
    } else {
      semLugar.push(usuario)
    }
  }

  // Quem tem um perfil com baia reservada flutua primeiro entre as baias
  // do próprio perfil; os demais, em qualquer baia livre que não seja
  // reservada a outro perfil. Se não sobrar vaga nem ali, como último
  // recurso ocupa qualquer outra baia reservada que esteja livre hoje —
  // exceto as de Estag/Aprendiz, Trainee e Supervisor, que continuam
  // exclusivas mesmo sem ninguém do perfil delas presente.
  const livrePara = (perfilUsuario: string) => {
    const baiasDoPerfil = baiasReservadas.filter(b => baiasPerfil[b] === perfilUsuario)
    if (baiasDoPerfil.length > 0) {
      const vaga = baiasDoPerfil.find(n => !ocupantes[n])
      if (vaga) return vaga
    } else {
      const vagaComum = Array.from({ length: 9 }, (_, i) => String(i + 1)).find(n => !ocupantes[n] && !baiasReservadas.includes(n))
      if (vagaComum) return vagaComum
    }
    return baiasReservadas.find(n =>
      !ocupantes[n] && baiasPerfil[n] !== perfilUsuario && !baiaEhExclusiva(baiasPerfil[n])
    )
  }

  for (const usuario of semLugar) {
    const vaga = livrePara(usuario.role)
    if (vaga) ocupantes[vaga] = usuario.nome
  }

  const ocupantesAprendiz = calcularOcupantesJovemAprendiz(tecnicosSuporte, uidsPresencialHoje, uidsEmCursoHoje, baiasPerfil)
  const baiasJovemAprendiz: Record<string, string> = {}
  for (const b of baiasReservadas) {
    if (ehJovemAprendiz(baiasPerfil[b])) baiasJovemAprendiz[b] = baiasPerfil[b]
  }

  return { ocupantes, ocupantesAprendiz, baiasJovemAprendiz, baiaSupervisor }
}
