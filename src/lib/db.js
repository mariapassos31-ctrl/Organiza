import 'server-only'
import { Pool } from 'pg'

let pool

export function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT || 5432),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      options: `-c search_path=${process.env.DATABASE_SCHEMA || 'escala_ti'}`,
      max: 10,
    })
  }
  return pool
}

export function query(text, params) {
  return getPool().query(text, params)
}

export async function equipeIdFromSlug(slug) {
  if (!slug) return null
  const { rows } = await query('SELECT cd_equipe FROM equipes WHERE tp_equipe = $1', [slug])
  return rows[0]?.cd_equipe ?? null
}

// Resolve usuario ids (uid = cd_usuario as string, vindos do front-end)
// para cd_tecnico, via o vínculo tecnicos.cd_usuario. Quando `equipeId` é
// informado, só resolve técnicos DAQUELA equipe — sem isso, um uid de outra
// equipe poderia ser injetado numa escala que não é a dele.
export async function tecnicoIdsFromUids(uids, equipeId = null) {
  if (!uids || uids.length === 0) return []
  const usuarioIds = uids.map(Number).filter(n => !Number.isNaN(n))
  if (usuarioIds.length === 0) return []

  const params = [usuarioIds]
  let sql = 'SELECT cd_tecnico FROM tecnicos WHERE cd_usuario = ANY($1::int[])'
  if (equipeId) {
    params.push(equipeId)
    sql += ` AND cd_equipe = $${params.length}`
  }

  const { rows } = await query(sql, params)
  return rows.map(r => r.cd_tecnico)
}
