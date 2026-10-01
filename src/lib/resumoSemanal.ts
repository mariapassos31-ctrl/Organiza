import { query } from './db'
import { addDays } from './escalasRodizio'
import { notificarResumoSemanal } from './emailNotificacoes'
import { gerarMapaSuporteParaEmail } from './mapaEmailImagem'

// Resumo semanal da escala: substitui o antigo e-mail imediato de "nova
// escala" (disparado toda vez que o gerador automático rodava — virava uma
// avalanche quando alguém gerava um mês inteiro de uma vez, e o mapa
// anexado podia estar desatualizado semanas depois se alguém trocasse a
// escala nesse meio tempo). Trocas continuam avisando na hora (precisa de
// ação/confirmação); a atribuição em si vira esse resumo, calculado em
// cima do estado ATUAL da escala (já reflete qualquer troca que tenha
// acontecido depois da geração).
//
// Chamado de hora em hora por um agendador externo (ver
// src/app/api/cron/resumo-semanal/route.ts), checando se está na janela de
// envio — sexta a partir das 14h até domingo (cobre o servidor ter ficado
// fora do ar bem na sexta:
// manda atrasado assim que voltar, em vez de pular a semana). Depois de
// segunda não faz mais sentido mandar "semana que vem" atrasado, então
// para de tentar.
const HORA_DE_ENVIO = 14

function dentroDaJanelaDeEnvio(agora: Date): boolean {
  const dia = agora.getDay() // 0=dom ... 5=sex ... 6=sáb
  if (dia === 6 || dia === 0) return true
  return dia === 5 && agora.getHours() >= HORA_DE_ENVIO
}

// A partir de qualquer dia dentro da janela (sex/sáb/dom), a "semana que
// vem" é sempre a próxima segunda-feira.
function proximaSegunda(agora: Date): string {
  const offsetPorDia: Record<number, number> = { 5: 3, 6: 2, 0: 1 }
  const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  return addDays(hojeISO, offsetPorDia[agora.getDay()])
}

// Mesma ideia, mas pra qualquer dia da semana (não só sex/sáb/dom) — usada
// só pelo disparo manual de teste, que não precisa respeitar a janela real.
function proximaSegundaQualquerDia(agora: Date): string {
  const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  const dia = agora.getDay()
  const offset = dia === 0 ? 1 : 8 - dia
  return addDays(hojeISO, offset)
}

async function jaFoiEnviadoPara(dtSemana: string): Promise<boolean> {
  const { rows } = await query(`SELECT 1 FROM resumo_semanal_enviado WHERE dt_semana = $1`, [dtSemana])
  return rows.length > 0
}

async function marcarComoEnviado(dtSemana: string): Promise<void> {
  await query(`INSERT INTO resumo_semanal_enviado (dt_semana) VALUES ($1) ON CONFLICT (dt_semana) DO NOTHING`, [dtSemana])
}

interface BlocoSemana {
  tipo: string
  dtInicio: string
  dtFim: string
  cdEquipe: number
  cdSala: number | null
}

async function montarResumoDaSemana(segunda: string, domingo: string): Promise<void> {
  const { rows: escalaRows } = await query<{
    cd_tecnico: number; cd_equipe: number; cd_sala: number | null; tp_escala: string; dt_inicio: string; dt_fim: string
  }>(
    `SELECT t.cd_tecnico, es.cd_equipe, es.cd_sala, es.tp_escala,
            to_char(es.dt_inicio, 'YYYY-MM-DD') AS dt_inicio, to_char(es.dt_fim, 'YYYY-MM-DD') AS dt_fim
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     WHERE es.tp_status != 'cancelada'
       AND es.tp_escala = ANY($3::text[])
       AND es.dt_inicio <= $2 AND es.dt_fim >= $1`,
    [segunda, domingo, ['presencial', 'homeoffice', 'sabado', 'sobreaviso']]
  )
  if (escalaRows.length === 0) return

  // Cada bloco só mostra os dias que caem DENTRO da semana do resumo — uma
  // escala de sábado a sábado, por exemplo, não deveria listar dias de
  // fora da janela que está sendo resumida.
  const blocosPorTecnico = new Map<number, BlocoSemana[]>()
  for (const r of escalaRows) {
    const lista = blocosPorTecnico.get(r.cd_tecnico) || []
    lista.push({
      tipo: r.tp_escala,
      dtInicio: r.dt_inicio < segunda ? segunda : r.dt_inicio,
      dtFim: r.dt_fim > domingo ? domingo : r.dt_fim,
      cdEquipe: r.cd_equipe,
      cdSala: r.cd_sala,
    })
    blocosPorTecnico.set(r.cd_tecnico, lista)
  }

  const cdEquipesEnvolvidas = [...new Set([...blocosPorTecnico.values()].flat().map(b => b.cdEquipe))]
  const cdSalasEnvolvidas = [...new Set([...blocosPorTecnico.values()].flat().map(b => b.cdSala).filter((v): v is number => v != null))]

  const { rows: salasRows } = cdSalasEnvolvidas.length > 0
    ? await query<{ cd_sala: number; nm_sala: string }>(`SELECT cd_sala, nm_sala FROM salas WHERE cd_sala = ANY($1::int[])`, [cdSalasEnvolvidas])
    : { rows: [] as Array<{ cd_sala: number; nm_sala: string }> }
  const nomeSalaPorId = new Map(salasRows.map(s => [s.cd_sala, s.nm_sala]))

  const { rows: salaPorEquipeRows } = cdEquipesEnvolvidas.length > 0
    ? await query<{ cd_equipe: number; nm_sala: string }>(
        `SELECT se.cd_equipe, s.nm_sala FROM sala_equipes se JOIN salas s ON s.cd_sala = se.cd_sala WHERE se.cd_equipe = ANY($1::int[])`,
        [cdEquipesEnvolvidas]
      )
    : { rows: [] as Array<{ cd_equipe: number; nm_sala: string }> }
  const salaUnicaPorEquipe = new Map<number, string>()
  for (const cdEquipe of cdEquipesEnvolvidas) {
    const salasDaEquipe = salaPorEquipeRows.filter(r => r.cd_equipe === cdEquipe)
    if (salasDaEquipe.length === 1) salaUnicaPorEquipe.set(cdEquipe, salasDaEquipe[0].nm_sala)
  }

  const { rows: labConfigRows } = cdEquipesEnvolvidas.length > 0
    ? await query<{ cd_equipe: number; cd_usuario_responsavel: number | null }>(
        `SELECT cd_equipe, cd_usuario_responsavel FROM laboratorio_config WHERE cd_equipe = ANY($1::int[])`,
        [cdEquipesEnvolvidas]
      )
    : { rows: [] as Array<{ cd_equipe: number; cd_usuario_responsavel: number | null }> }
  const labResponsavelPorEquipe = new Map(labConfigRows.map(r => [r.cd_equipe, r.cd_usuario_responsavel]))

  const { rows: pessoas } = await query<{ cd_tecnico: number; cd_usuario: number; ds_email: string; nm_usuario: string; nr_baia: number | null; sn_baia_fixa: boolean }>(
    `SELECT t.cd_tecnico, u.cd_usuario, u.ds_email, u.nm_usuario, t.nr_baia, t.sn_baia_fixa
     FROM tecnicos t JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE t.cd_tecnico = ANY($1::int[]) AND u.sn_ativo`,
    [[...blocosPorTecnico.keys()]]
  )

  const resolverLocal = (b: BlocoSemana, pessoa: { cd_usuario: number; nr_baia: number | null; sn_baia_fixa: boolean }): string | null => {
    if (b.tipo !== 'presencial') return null
    if (labResponsavelPorEquipe.get(b.cdEquipe) === pessoa.cd_usuario) return 'Laboratório'
    const nomeSala = (b.cdSala != null ? nomeSalaPorId.get(b.cdSala) : null) || salaUnicaPorEquipe.get(b.cdEquipe) || null
    const mesa = pessoa.sn_baia_fixa && pessoa.nr_baia != null ? `mesa ${pessoa.nr_baia}` : null
    return [nomeSala, mesa].filter(Boolean).join(' — ') || null
  }

  // Mapa de ocupação (imagem) só do primeiro dia presencial da semana, de
  // cada pessoa — quem divide equipe/dia reaproveita o mesmo mapa gerado.
  const primeiroPresencialPorTecnico = new Map<number, { cdEquipe: number; dtInicio: string }>()
  for (const [cdTecnico, blocos] of blocosPorTecnico) {
    const primeiro = blocos.filter(b => b.tipo === 'presencial').sort((a, b) => a.dtInicio.localeCompare(b.dtInicio))[0]
    if (primeiro) primeiroPresencialPorTecnico.set(cdTecnico, { cdEquipe: primeiro.cdEquipe, dtInicio: primeiro.dtInicio })
  }
  const chaveMapa = (v: { cdEquipe: number; dtInicio: string }) => `${v.cdEquipe}:${v.dtInicio}`
  const mapaPorChave = new Map<string, Buffer | null>()
  for (const alvo of new Set([...primeiroPresencialPorTecnico.values()].map(chaveMapa))) {
    const [cdEquipeStr, dtInicio] = alvo.split(':')
    mapaPorChave.set(alvo, await gerarMapaSuporteParaEmail(Number(cdEquipeStr), dtInicio))
  }

  await Promise.all(pessoas.map(p => {
    const alvoMapa = primeiroPresencialPorTecnico.get(p.cd_tecnico)
    const mapaImagem = alvoMapa ? mapaPorChave.get(chaveMapa(alvoMapa)) ?? null : null
    return notificarResumoSemanal(
      { email: p.ds_email, nome: p.nm_usuario },
      (blocosPorTecnico.get(p.cd_tecnico) || []).map(b => ({ ...b, local: resolverLocal(b, p) })),
      mapaImagem
    )
  }))
}

// Chamado por um agendador EXTERNO (Tarefas Agendadas do Windows, cron,
// etc. — ver src/app/api/cron/resumo-semanal/route.ts), de hora em hora.
// Não precisa de precisão de minuto, é só pra não deixar a janela (sexta
// 14h ao fim do domingo) passar em branco.
export async function enviarResumoSemanalSeNecessario(agora: Date = new Date()): Promise<void> {
  // Interruptor explícito — precisa de RESUMO_SEMANAL_ATIVO=true no
  // .env.local pra mandar de verdade. Sem isso, mesmo com o agendador
  // externo configurado e chamando essa rota, nada é enviado — assim
  // ligar o envio automático é uma decisão consciente.
  if (process.env.RESUMO_SEMANAL_ATIVO !== 'true') return
  if (!dentroDaJanelaDeEnvio(agora)) return
  const segunda = proximaSegunda(agora)
  if (await jaFoiEnviadoPara(segunda)) return
  const domingo = addDays(segunda, 6)
  await montarResumoDaSemana(segunda, domingo)
  await marcarComoEnviado(segunda)
}

// Disparo manual de teste (ver ?teste=true na rota de cron) — ignora a
// janela sexta~domingo e o controle de "já enviado essa semana" (pra dar
// pra rodar de novo à vontade enquanto testa), mas continua passando pelo
// enviarEmail() normal — ou seja, só é seguro chamar isso com
// EMAIL_TESTE_PARA configurado, senão manda de verdade pra todo mundo que
// tiver escala na semana. Não grava em resumo_semanal_enviado, então não
// interfere no agendamento real.
export async function enviarResumoSemanalTeste(agora: Date = new Date()): Promise<{ segunda: string; domingo: string }> {
  const segunda = proximaSegundaQualquerDia(agora)
  const domingo = addDays(segunda, 6)
  await montarResumoDaSemana(segunda, domingo)
  return { segunda, domingo }
}
