import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'

export async function GET() {
  try {
    const result = await query('select now() as now, current_schema() as schema')
    return NextResponse.json({ ok: true, ...result.rows[0] })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
