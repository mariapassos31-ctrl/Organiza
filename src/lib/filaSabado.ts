import 'server-only'
import { query } from './db'
import type { PoolClient } from 'pg'

// Fila customizada de rodízio da Escala Sábado (por equipe) — quando
// cadastrada, o gerador segue essa ordem em vez da alfabética padrão. Não
// dá pra criar uma tabela nova (o usuário do banco não tem permissão de
// CREATE TABLE nesse schema), então reaproveita `grupos_escala`: essa
// tabela já tinha 'sabado' previsto no CHECK de tp_grupo_escala, mas nunca
// foi usada por nenhuma tela — não existe coluna de "posição na fila", só
// um cd_ultimo_tecnico (FK pra tecnicos) por linha. Por isso guarda UMA
// LINHA POR TÉCNICO da fila, na ordem certa: a ordem vem do próprio
// cd_grupo_escala (auto-incremento), respeitando a ordem de inserção —
// reordenar é sempre "apaga tudo e recria na sequência nova".
const TIPO_GRUPO = 'sabado'

export async function buscarFilaSabado(equipeId: number): Promise<number[]> {
  const { rows } = await query(
    `SELECT cd_ultimo_tecnico AS cd_tecnico FROM grupos_escala
     WHERE cd_equipe = $1 AND tp_grupo_escala = $2 AND sn_ativo = true
     ORDER BY cd_grupo_escala`,
    [equipeId, TIPO_GRUPO]
  )
  return rows.map(r => Number(r.cd_tecnico))
}

export async function salvarFilaSabado(client: PoolClient, equipeId: number, cdTecnicos: number[]): Promise<void> {
  await client.query(`DELETE FROM grupos_escala WHERE cd_equipe = $1 AND tp_grupo_escala = $2`, [equipeId, TIPO_GRUPO])
  for (const cdTecnico of cdTecnicos) {
    await client.query(
      `INSERT INTO grupos_escala (nm_grupo_escala, tp_grupo_escala, tp_frequencia, cd_equipe, cd_ultimo_tecnico, sn_ativo)
       VALUES ($1, $2, 'weekly', $3, $4, true)`,
      ['Fila de Sábado', TIPO_GRUPO, equipeId, cdTecnico]
    )
  }
}

// Substituir alguém na fila (ex: foi desligado) transfere pra quem entrou
// no lugar dela TODOS os sábados que ela já tinha agendados de hoje em
// diante — sem isso, a fila mudaria pro futuro, mas os sábados já gerados
// continuariam com quem saiu, obrigando a trocar cada um na mão. Sábados
// que já passaram ficam intactos (são histórico de quem realmente
// trabalhou naquele dia).
export async function transferirSabadosFuturos(client: PoolClient, deCdTecnico: number, paraCdTecnico: number): Promise<number> {
  const { rowCount } = await client.query(
    `UPDATE escala_tecnicos SET cd_tecnico = $2
     WHERE cd_tecnico = $1
       AND cd_escala IN (
         SELECT cd_escala FROM escalas
         WHERE tp_escala = 'sabado' AND tp_status != 'cancelada' AND dt_inicio >= CURRENT_DATE
       )`,
    [deCdTecnico, paraCdTecnico]
  )
  return rowCount ?? 0
}
