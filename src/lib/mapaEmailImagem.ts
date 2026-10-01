import sharp from 'sharp'
import { readFile } from 'fs/promises'
import path from 'path'
import { query } from './db'
import { ehJovemAprendiz } from './escalasConstants'
import { calcularOcupacaoBaias, POSICOES_BAIA } from './ocupacaoBaias'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from './salasConfig'
import type { Escala, Usuario } from '../types/dominio'

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0]
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function etiquetaSvg(cx: number, cy: number, texto: string, cor: string, tamanhoFonte: number): string {
  const label = escapeXml(texto)
  const largura = Math.max(46, label.length * (tamanhoFonte * 0.62) + 16)
  return `<g>
    <rect x="${cx - largura / 2}" y="${cy - 13}" width="${largura}" height="26" rx="13" fill="${cor}" fill-opacity="0.94"/>
    <text x="${cx}" y="${cy + 5}" font-family="Arial, sans-serif" font-size="${tamanhoFonte}" font-weight="600" fill="#ffffff" text-anchor="middle">${label}</text>
  </g>`
}

// Compõe a imagem fixa do mapa (public/images/mapa-baias.png) com etiquetas
// de nome em cima de cada baia ocupada — mesmas posições (POSICOES_BAIA)
// que a tela usa pra desenhar o mapa interativo, só que "renderizado" numa
// imagem estática (útil em e-mail, que não roda o componente React).
async function compositarMapa(
  ocupantes: Record<string, string>,
  ocupantesAprendiz: Record<string, Array<{ nome: string; turno?: string | null }>>
): Promise<Buffer> {
  const imagemPath = path.join(process.cwd(), 'public', 'images', 'mapa-baias.png')
  const imagemBuffer = await readFile(imagemPath)
  const base = sharp(imagemBuffer)
  const meta = await base.metadata()
  const largura = meta.width || 800
  const altura = meta.height || 600
  const pct = (v: string) => parseFloat(v) / 100

  const etiquetas: string[] = []
  for (const [baia, nome] of Object.entries(ocupantes)) {
    const pos = POSICOES_BAIA[baia]
    if (!pos) continue
    etiquetas.push(etiquetaSvg(pct(pos.left) * largura, pct(pos.top) * altura, primeiroNome(nome), '#6c2b3e', 13))
  }
  for (const [baia, pessoas] of Object.entries(ocupantesAprendiz)) {
    const pos = POSICOES_BAIA[baia]
    if (!pos || pessoas.length === 0) continue
    const texto = pessoas.map(p => `${primeiroNome(p.nome)}${p.turno ? ` (${p.turno[0]})` : ''}`).join(' / ')
    etiquetas.push(etiquetaSvg(pct(pos.left) * largura, pct(pos.top) * altura, texto, '#521d30', 11))
  }

  const svg = `<svg width="${largura}" height="${altura}" xmlns="http://www.w3.org/2000/svg">${etiquetas.join('')}</svg>`
  return base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer()
}

// Só a Sala Suporte tem mapa visual (posições fixas, POSICOES_BAIA) — pra
// qualquer outra sala (imagem própria, genérica) ainda não geramos essa
// imagem pro e-mail. Devolve null nesse caso (e em qualquer erro — gerar o
// mapa nunca pode impedir o e-mail/a escala de irem adiante).
export async function gerarMapaSuporteParaEmail(cdEquipe: number, dataISO: string): Promise<Buffer | null> {
  try {
    const { rows: salaRows } = await query<{ cd_sala: number }>(
      `SELECT s.cd_sala FROM salas s JOIN sala_equipes se ON se.cd_sala = s.cd_sala
       WHERE se.cd_equipe = $1 AND s.ds_imagem = $2 LIMIT 1`,
      [cdEquipe, IMAGEM_COM_POSICOES_CONHECIDAS]
    )
    const cdSala = salaRows[0]?.cd_sala
    if (!cdSala) return null

    const { rows: baiasRows } = await query<{ nr_baia: number; tp_perfil: string | null }>(
      `SELECT nr_baia, tp_perfil FROM sala_baias WHERE cd_sala = $1`,
      [cdSala]
    )
    const baiasPerfil: Record<string, string> = {}
    for (const b of baiasRows) if (b.tp_perfil) baiasPerfil[String(b.nr_baia)] = b.tp_perfil

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { rows: tecRows } = await query<any>(
      `SELECT u.cd_usuario, u.nm_usuario, u.tp_role, t.cd_tecnico, t.hr_entrada, t.nr_baia, t.sn_baia_fixa, t.nr_dia_curso,
              to_char(t.dt_ferias_inicio, 'YYYY-MM-DD') AS dt_ferias_inicio,
              to_char(t.dt_ferias_fim, 'YYYY-MM-DD') AS dt_ferias_fim
       FROM usuarios u JOIN tecnicos t ON t.cd_usuario = u.cd_usuario
       WHERE u.cd_equipe = $1`,
      [cdEquipe]
    )
    const cdTecnicosSuporte = tecRows.map(r => r.cd_tecnico)
    const { rows: feriasExtrasRows } = cdTecnicosSuporte.length > 0
      ? await query<{ cd_tecnico: number; dt_inicio: string; dt_fim: string }>(
          `SELECT cd_tecnico, to_char(dt_inicio, 'YYYY-MM-DD') AS dt_inicio, to_char(dt_fim, 'YYYY-MM-DD') AS dt_fim
           FROM tecnico_ferias WHERE cd_tecnico = ANY($1::int[])`,
          [cdTecnicosSuporte]
        )
      : { rows: [] as Array<{ cd_tecnico: number; dt_inicio: string; dt_fim: string }> }
    const feriasExtrasPorTecnico = new Map<number, Array<{ inicio: string; fim: string }>>()
    for (const f of feriasExtrasRows) {
      const lista = feriasExtrasPorTecnico.get(f.cd_tecnico) || []
      lista.push({ inicio: f.dt_inicio, fim: f.dt_fim })
      feriasExtrasPorTecnico.set(f.cd_tecnico, lista)
    }
    const tecnicosSuporte: Usuario[] = tecRows.map(r => ({
      uid: String(r.cd_usuario),
      nome: r.nm_usuario,
      email: '',
      role: r.tp_role,
      equipe: null,
      matricula: '',
      especialidade: '',
      horarioEntrada: r.hr_entrada ? String(r.hr_entrada).slice(0, 5) : '',
      baia: r.nr_baia != null ? String(r.nr_baia) : '',
      baiaFixa: Boolean(r.sn_baia_fixa),
      elegivelHomeOffice: true,
      ehSupervisor: r.nr_baia === 0,
      ehAprendiz: ehJovemAprendiz(r.tp_role),
      diaCurso: r.nr_dia_curso ?? null,
      feriasInicio: r.dt_ferias_inicio || '',
      feriasFim: r.dt_ferias_fim || '',
      feriasExtras: feriasExtrasPorTecnico.get(r.cd_tecnico) || [],
      ativo: true,
      criadoEm: '',
    }))

    const { rows: escalaRows } = await query<{ cd_usuario: number; tp_escala: string }>(
      `SELECT t.cd_usuario, es.tp_escala
       FROM escalas es
       JOIN escala_tecnicos et ON et.cd_escala = es.cd_escala
       JOIN tecnicos t ON t.cd_tecnico = et.cd_tecnico
       WHERE es.cd_equipe = $1 AND es.tp_status != 'cancelada'
         AND es.tp_escala = ANY($3::text[])
         AND es.dt_inicio <= $2 AND es.dt_fim >= $2`,
      [cdEquipe, dataISO, ['presencial', 'sabado', 'homeoffice']]
    )
    const escalasSuporte: Escala[] = escalaRows.map(r => ({
      id: '', tipo: r.tp_escala, dataInicio: dataISO, dataFim: dataISO,
      tecnicos: [String(r.cd_usuario)], equipe: null, descricao: null, status: 'ativa',
      criadoPor: null, dataCriacao: '', salaId: null,
    }))

    // Mesma lógica de fallback pro backup (responsável de férias/home
    // office nesse dia) que já existe em DiaDetalhadoModal — só pra saber
    // quem NÃO entra no rodízio de baia comum, não repete a exibição.
    const { rows: labRows } = await query<{ cd_usuario_responsavel: number | null; cd_usuario_backup: number | null }>(
      `SELECT cd_usuario_responsavel, cd_usuario_backup FROM laboratorio_config WHERE cd_equipe = $1`,
      [cdEquipe]
    )
    const { rows: extRows } = await query<{ cd_usuario_responsavel: number | null; cd_usuario_backup: number | null }>(
      `SELECT cd_usuario_responsavel, cd_usuario_backup FROM externo_config WHERE cd_equipe = $1`,
      [cdEquipe]
    )
    const homeOfficeHoje = new Set(escalasSuporte.filter(e => e.tipo === 'homeoffice').map(e => e.tecnicos[0]))
    const estaDeFeriasHoje = (uid: string) => {
      const u = tecnicosSuporte.find(x => x.uid === uid)
      if (!u) return false
      if (u.feriasInicio && u.feriasFim && u.feriasInicio <= dataISO && dataISO <= u.feriasFim) return true
      return Boolean(u.feriasExtras?.some(p => p.inicio <= dataISO && dataISO <= p.fim))
    }
    const resolverUidNoCargo = (responsavelUid: string | null, backupUid: string | null): string | null => {
      if (!responsavelUid) return null
      const ausente = homeOfficeHoje.has(responsavelUid) || estaDeFeriasHoje(responsavelUid)
      return ausente ? backupUid : responsavelUid
    }
    const lab = labRows[0]
    const ext = extRows[0]
    const uidNoLaboratorioHoje = lab ? resolverUidNoCargo(lab.cd_usuario_responsavel != null ? String(lab.cd_usuario_responsavel) : null, lab.cd_usuario_backup != null ? String(lab.cd_usuario_backup) : null) : null
    const uidNoExternoHoje = ext ? resolverUidNoCargo(ext.cd_usuario_responsavel != null ? String(ext.cd_usuario_responsavel) : null, ext.cd_usuario_backup != null ? String(ext.cd_usuario_backup) : null) : null

    const resultado = calcularOcupacaoBaias(
      escalasSuporte, tecnicosSuporte, new Date(`${dataISO}T00:00:00`), baiasPerfil, uidNoLaboratorioHoje, uidNoExternoHoje
    )

    return await compositarMapa(resultado.ocupantes, resultado.ocupantesAprendiz)
  } catch (error) {
    console.error('[mapaEmailImagem] Falha ao gerar mapa pro e-mail:', error)
    return null
  }
}
