import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { auth } from '../../../auth'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { rows } = await query(
    'SELECT tp_equipe, nm_equipe, ds_cor FROM equipes WHERE sn_ativo = true ORDER BY nm_equipe'
  )

  return NextResponse.json(rows.map(row => ({
    id: row.tp_equipe,
    label: row.nm_equipe,
    cor: row.ds_cor,
  })))
}
