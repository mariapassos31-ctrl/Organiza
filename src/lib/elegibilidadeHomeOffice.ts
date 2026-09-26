import { query } from './db'

// Quem já está em home office no mesmo período, na mesma equipe, com a
// mesma especialidade de quem vai entrar? (exclui o próprio técnico que
// está saindo, senão ele sempre "colide" consigo mesmo). Devolve o(s)
// nome(s) de quem colide, pra poder avisar exatamente quem é — ou array
// vazio se não há conflito. Mesma regra que o gerador automático aplica ao
// montar o grupo do dia (por isso é escopada por equipe, não por sala:
// reproduz fielmente o caso de sala única, que é onde essa regra vale) —
// reaproveitada por qualquer atribuição manual de home office (troca de
// escala, troca direta feita por admin/gestor).
export async function quemColideEspecialidadeNoHomeOffice(
  cdEquipe: number,
  dtInicio: string,
  dtFim: string,
  especialidade: string | null,
  cdTecnicoExcluir: number
): Promise<string[]> {
  if (!especialidade) return []
  const { rows } = await query(
    `SELECT DISTINCT t.nm_tecnico
     FROM escalas es
     JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
     JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
     WHERE es.cd_equipe = $1 AND es.tp_escala = 'homeoffice' AND es.tp_status != 'cancelada'
       AND es.dt_inicio <= $3 AND es.dt_fim >= $2
       AND et.cd_tecnico != $4 AND t.ds_especialidade = $5`,
    [cdEquipe, dtInicio, dtFim, cdTecnicoExcluir, especialidade]
  )
  return rows.map(r => r.nm_tecnico)
}

// Junta os nomes numa frase pronta pra mensagem de erro, ex:
// "Ricardo e Sergio" ou "Ricardo, Sergio e Ana".
export function listarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] || ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
