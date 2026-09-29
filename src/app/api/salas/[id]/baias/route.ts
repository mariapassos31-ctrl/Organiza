import { mensagemDeErro } from '@/lib/erros'
import { NextResponse } from 'next/server'
import { query, equipeIdFromSlug } from '../../../../../lib/db'
import { auth } from '../../../../../auth'
import { ehPerfilGestao } from '../../../../../lib/equipesConfig'

// Muda a reserva de uma baia de uma sala. O modo (por perfil ou por
// equipe) é decidido sozinho pela quantidade de equipes vinculadas à
// sala — não vem no corpo da requisição.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { role: minhaRole, equipe: minhaEquipe } = session.user
  if (!ehPerfilGestao(minhaRole)) {
    return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
  }

  try {
    const { id } = await params
    const cdSala = Number(id)
    const body = await request.json()
    const { baia, perfil, especialidade } = body
    let { equipe } = body

    const { rows: salaRows } = await query('SELECT qtd_baias FROM salas WHERE cd_sala = $1', [cdSala])
    if (salaRows.length === 0) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }
    const numero = Number(baia)
    if (!Number.isInteger(numero) || numero < 0 || numero > salaRows[0].qtd_baias) {
      return NextResponse.json({ error: 'Número da baia inválido' }, { status: 400 })
    }

    const { rows: equipesRows } = await query(
      `SELECT e.cd_equipe, e.tp_equipe FROM sala_equipes se
       JOIN equipes e ON e.cd_equipe = se.cd_equipe
       WHERE se.cd_sala = $1`,
      [cdSala]
    )
    if (equipesRows.length === 0) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }
    const equipesDaSala = equipesRows.map(r => r.tp_equipe)
    const modoReserva = equipesRows.length > 1 ? 'equipe' : 'perfil'

    if (modoReserva === 'perfil') {
      // Uma equipe só: a reivindicação é sempre dela, e só quem é dessa
      // equipe (ou admin) pode configurar.
      const donaSlug = equipesDaSala[0]
      if (minhaRole !== 'admin' && minhaEquipe !== donaSlug) {
        return NextResponse.json({ error: 'Você não pode configurar essa sala' }, { status: 403 })
      }
      const equipeId = equipesRows[0].cd_equipe

      if (!perfil) {
        await query('DELETE FROM sala_baias WHERE cd_sala = $1 AND nr_baia = $2', [cdSala, numero])
        return NextResponse.json({ ok: true })
      }

      // "supervisor" só pode estar em uma baia por vez.
      if (perfil === 'supervisor') {
        await query(
          'DELETE FROM sala_baias WHERE cd_sala = $1 AND tp_perfil = $2 AND nr_baia != $3',
          [cdSala, 'supervisor', numero]
        )
      }
      await query(
        `INSERT INTO sala_baias (cd_sala, nr_baia, cd_equipe, tp_perfil, tp_especialidade)
         VALUES ($1, $2, $3, $4, NULL)
         ON CONFLICT (cd_sala, nr_baia) DO UPDATE
           SET cd_equipe = EXCLUDED.cd_equipe, tp_perfil = EXCLUDED.tp_perfil, tp_especialidade = NULL`,
        [cdSala, numero, equipeId, perfil]
      )
      return NextResponse.json({ ok: true })
    }

    // Sala compartilhada por várias equipes: cada gestor só reivindica pra
    // própria equipe (admin escolhe qualquer uma via body.equipe) — mas só
    // quando está de fato reivindicando. Se `equipe` já veio vazio (a
    // intenção é liberar a baia), não força nada aqui, senão ele nunca
    // conseguiria limpar a própria baia.
    if (minhaRole !== 'admin' && equipe) {
      equipe = minhaEquipe
    }

    // Gestor só mexe em baia livre ou já reivindicada pela própria
    // equipe — nunca toma a baia de outra equipe. Admin pode qualquer uma.
    if (minhaRole !== 'admin') {
      const { rows: atualRows } = await query(
        `SELECT e.tp_equipe FROM sala_baias sb
         JOIN equipes e ON e.cd_equipe = sb.cd_equipe
         WHERE sb.cd_sala = $1 AND sb.nr_baia = $2`,
        [cdSala, numero]
      )
      const donoAtual = atualRows[0]?.tp_equipe
      if (donoAtual && donoAtual !== minhaEquipe) {
        return NextResponse.json({ error: `Essa baia já é da equipe ${donoAtual}` }, { status: 403 })
      }
    }

    if (!equipe) {
      await query('DELETE FROM sala_baias WHERE cd_sala = $1 AND nr_baia = $2', [cdSala, numero])
      return NextResponse.json({ ok: true })
    }

    if (!equipesDaSala.includes(equipe)) {
      return NextResponse.json({ error: 'Essa equipe não usa essa sala' }, { status: 400 })
    }
    const equipeId = await equipeIdFromSlug(equipe)

    await query(
      `INSERT INTO sala_baias (cd_sala, nr_baia, cd_equipe, tp_perfil, tp_especialidade)
       VALUES ($1, $2, $3, NULL, $4)
       ON CONFLICT (cd_sala, nr_baia) DO UPDATE
         SET cd_equipe = EXCLUDED.cd_equipe, tp_perfil = NULL, tp_especialidade = EXCLUDED.tp_especialidade`,
      [cdSala, numero, equipeId, especialidade || null]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: mensagemDeErro(error) }, { status: 400 })
  }
}
