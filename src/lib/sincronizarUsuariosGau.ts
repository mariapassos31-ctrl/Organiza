import 'server-only'
import { query, equipeIdFromSlug } from './db'
import { listarUsuariosGau, papelDoGau } from './gauPerfis'
import { equipeDoTimeRh } from './mapaEquipeRh'
import { provisionarUsuarioDoGau } from './provisionarUsuario'
import { buscarAniversariantesTiRh } from './rhAniversariantes'

interface UsuarioLocalResumo {
  cd_usuario: number
  nm_usuario: string
  ds_email: string
  tp_role: string
  ds_matricula: string | null
  tp_equipe: string | null
}

export interface ItemUsuarioGau {
  nome: string | null
  email: string | null
  matricula: string | null
  perfis: string[]
  papelGau: string | null
  local: { uid: string; nome: string; role: string; equipe: string | null } | null
  // Equipe resolvida pelo TIME do RH (ver lib/mapaEquipeRh.ts) — null quando
  // a matrícula não bateu com ninguém do RH ou o TIME não tem equivalente.
  equipeSugerida: string | null
  // true quando já tem cadastro local, mas com papel diferente do GAU —
  // a sincronização corrige pra bater com o GAU.
  mudaRole: boolean
}

function normalizar(valor: string | null | undefined): string {
  return String(valor ?? '').trim().toLowerCase()
}
function normalizarMatricula(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '')
}

// Prévia: todo mundo que o GAU autoriza pro Escala TI (tem algum perfil
// ESCTI_*), casado com o cadastro local e com o TIME do RH (pra equipe) —
// quem muda de papel, quem ainda não tem cadastro (vai ser criado já com a
// equipe resolvida, se der) e quem tem cadastro mas ficou sem equipe.
export async function prevSincronizacaoUsuariosGau(): Promise<ItemUsuarioGau[]> {
  const [gauUsuarios, { rows: locais }, colaboradoresRh] = await Promise.all([
    listarUsuariosGau(),
    query<UsuarioLocalResumo>(
      `SELECT u.cd_usuario, u.nm_usuario, u.ds_email, u.tp_role, u.ds_matricula, e.tp_equipe
       FROM usuarios u
       LEFT JOIN equipes e ON e.cd_equipe = u.cd_equipe
       WHERE u.sn_ativo = true`
    ),
    // Mesma fonte do card de aniversariantes (a VW_TIME inteira) — aqui só
    // interessa CHAPA/TIME. Se o RH estiver fora do ar, segue sem equipe
    // sugerida nenhuma em vez de travar a sincronização inteira.
    buscarAniversariantesTiRh().catch(() => []),
  ])

  const porEmail = new Map(locais.map(u => [normalizar(u.ds_email), u]))
  const porMatricula = new Map(
    locais.filter(u => u.ds_matricula).map(u => [normalizarMatricula(u.ds_matricula), u])
  )
  const timePorMatricula = new Map(colaboradoresRh.map(c => [normalizarMatricula(c.chapa), c.time]))

  return gauUsuarios.map(u => {
    const local = porEmail.get(normalizar(u.email)) ?? porMatricula.get(normalizarMatricula(u.matricula)) ?? null
    const papelGau = papelDoGau(u.perfis)
    const matriculaRh = u.matricula ?? local?.ds_matricula ?? null
    const equipeSugerida = equipeDoTimeRh(timePorMatricula.get(normalizarMatricula(matriculaRh)) ?? null)

    return {
      nome: u.nome,
      email: u.email,
      matricula: u.matricula,
      perfis: u.perfis,
      papelGau,
      local: local ? { uid: String(local.cd_usuario), nome: local.nm_usuario, role: local.tp_role, equipe: local.tp_equipe } : null,
      equipeSugerida,
      mudaRole: Boolean(local && papelGau && local.tp_role !== papelGau),
    }
  })
}

// Aplica: cria o cadastro local (com equipe, se o TIME do RH resolver) de
// quem o GAU autoriza e ainda não tem cadastro, corrige o papel de quem já
// tem cadastro mas está divergente, e preenche a equipe de quem está sem
// (nunca sobrescreve uma equipe já definida — só completa o vazio).
// Idempotente — rodar de novo sem mudanças no GAU/RH não faz nada.
export async function aplicarSincronizacaoUsuariosGau(): Promise<{ usuariosCriados: number; rolesAtualizadas: number; equipesPreenchidas: number }> {
  const itens = await prevSincronizacaoUsuariosGau()

  let usuariosCriados = 0
  for (const item of itens.filter(i => !i.local && i.papelGau)) {
    const criado = await provisionarUsuarioDoGau({
      nome: item.nome ?? item.email ?? '',
      email: item.email,
      matricula: item.matricula,
      role: item.papelGau!,
      equipe: item.equipeSugerida,
    })
    if (criado) usuariosCriados++
  }

  let rolesAtualizadas = 0
  for (const item of itens.filter(i => i.mudaRole && i.local && i.papelGau)) {
    const { rowCount } = await query('UPDATE usuarios SET tp_role = $1 WHERE cd_usuario = $2', [item.papelGau, Number(item.local!.uid)])
    rolesAtualizadas += rowCount ?? 0
  }

  let equipesPreenchidas = 0
  for (const item of itens.filter(i => i.local && !i.local!.equipe && i.equipeSugerida)) {
    const cdUsuario = Number(item.local!.uid)
    const equipeId = await equipeIdFromSlug(item.equipeSugerida!)
    if (!equipeId) continue

    const { rowCount } = await query('UPDATE usuarios SET cd_equipe = $1 WHERE cd_usuario = $2 AND cd_equipe IS NULL', [equipeId, cdUsuario])
    if (!rowCount) continue
    equipesPreenchidas += rowCount

    // Admin não entra em tecnicos (nunca é escalado — ver nuncaEhEscalado em
    // lib/equipesConfig.ts) mesmo tendo equipe só informativa preenchida
    // acima. Pra quem efetivamente é operacional, garante o vínculo em
    // tecnicos também (pode ter sido criado antes dessa sincronização ter
    // equipe resolvida).
    const papelEfetivo = item.papelGau ?? item.local!.role
    if (papelEfetivo === 'admin') continue

    await query(
      `INSERT INTO tecnicos (cd_usuario, nm_tecnico, cd_equipe)
       VALUES ($1, $2, $3)
       ON CONFLICT (cd_usuario) DO UPDATE SET cd_equipe = COALESCE(tecnicos.cd_equipe, EXCLUDED.cd_equipe)`,
      [cdUsuario, item.local!.nome, equipeId]
    )
  }

  return { usuariosCriados, rolesAtualizadas, equipesPreenchidas }
}
