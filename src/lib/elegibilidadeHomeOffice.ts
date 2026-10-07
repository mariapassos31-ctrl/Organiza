import { query } from './db'

// Analista G. (role "lider") e Analista (role "analista") do Suporte nunca
// ficam em home office no mesmo dia — a equipe fica sem nenhum dos dois
// pra resolver algo na hora. Só esses dois perfis colidem entre si; os
// demais (técnico, gestor, etc.) não têm par aqui.
const PAR_ROLE_SEM_HOME_OFFICE_JUNTOS: Record<string, string> = {
  lider: 'analista',
  analista: 'lider',
}

// Quem já está em home office no mesmo período, na mesma equipe, com a
// mesma especialidade de quem vai entrar? (exclui o(s) próprio(s) técnico(s)
// informado(s) em cdTecnicosExcluir — normalmente quem está saindo, pra
// não "colidir" consigo mesmo, E quem está do outro lado de uma troca
// direta, já que o fragmento que ele tem agora é exatamente o que está
// sendo passado adiante nessa mesma operação, não uma colisão de verdade
// com outra pessoa). Devolve o(s) nome(s) de quem colide, pra poder avisar
// exatamente quem é — ou array vazio se não há conflito. Mesma regra que o
// gerador automático aplica ao montar o grupo do dia (por isso é escopada
// por equipe, não por sala: reproduz fielmente o caso de sala única, que é
// onde essa regra vale) — reaproveitada por qualquer atribuição manual de
// home office (troca de escala, troca direta feita por admin/gestor).
export async function quemColideEspecialidadeNoHomeOffice(
  cdEquipe: number,
  dtInicio: string,
  dtFim: string,
  especialidade: string | null,
  cdTecnicosExcluir: number | number[]
): Promise<string[]> {
  if (!especialidade) return []
  const excluir = Array.isArray(cdTecnicosExcluir) ? cdTecnicosExcluir : [cdTecnicosExcluir]
  const { rows } = await query(
    `SELECT DISTINCT t.nm_tecnico
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     WHERE es.cd_equipe = $1 AND es.tp_escala = 'homeoffice' AND es.tp_status != 'cancelada'
       AND es.dt_inicio <= $3 AND es.dt_fim >= $2
       AND NOT (et.cd_tecnico = ANY($4::int[])) AND t.ds_especialidade = $5`,
    [cdEquipe, dtInicio, dtFim, excluir, especialidade]
  )
  return rows.map(r => r.nm_tecnico)
}

// Mesma ideia de quemColideEspecialidadeNoHomeOffice, mas pro par Analista
// G. / Analista: quem já está em home office no mesmo período, na mesma
// equipe, com o perfil que não pode ficar junto do perfil de quem vai
// entrar? Só retorna algo se o role tiver par definido (hoje só
// lider<->analista) — pra qualquer outro perfil, nunca colide por aqui.
export async function quemColideRoleNoHomeOffice(
  cdEquipe: number,
  dtInicio: string,
  dtFim: string,
  role: string | null,
  cdTecnicosExcluir: number | number[]
): Promise<string[]> {
  const roleQueColide = role ? PAR_ROLE_SEM_HOME_OFFICE_JUNTOS[role] : undefined
  if (!roleQueColide) return []
  const excluir = Array.isArray(cdTecnicosExcluir) ? cdTecnicosExcluir : [cdTecnicosExcluir]
  const { rows } = await query(
    `SELECT DISTINCT t.nm_tecnico
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     JOIN usuarios u ON u.cd_usuario = t.cd_usuario
     WHERE es.cd_equipe = $1 AND es.tp_escala = 'homeoffice' AND es.tp_status != 'cancelada'
       AND es.dt_inicio <= $3 AND es.dt_fim >= $2
       AND NOT (et.cd_tecnico = ANY($4::int[])) AND u.tp_role = $5`,
    [cdEquipe, dtInicio, dtFim, excluir, roleQueColide]
  )
  return rows.map(r => r.nm_tecnico)
}

// Junta os nomes numa frase pronta pra mensagem de erro, ex:
// "Ricardo e Sergio" ou "Ricardo, Sergio e Ana".
export function listarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] || ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
