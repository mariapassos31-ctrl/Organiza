import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'

export async function GET() {
  const { rows } = await query(
    'SELECT tp_equipe, nm_equipe, ds_cor FROM equipes WHERE sn_ativo = true ORDER BY nm_equipe'
  )

  return NextResponse.json(rows.map(row => ({
    id: row.tp_equipe,
    label: row.nm_equipe,
    cor: row.ds_cor,
  })))
}
