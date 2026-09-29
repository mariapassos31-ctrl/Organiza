'use client'

import type { Dispatch, SetStateAction } from 'react'

export function formatarDataBR(dataISO: string | null | undefined) {
  if (!dataISO) return ''
  return new Date(dataISO + 'T00:00:00').toLocaleDateString('pt-BR')
}

const DIAS_SEMANA_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Lista cada dia do período (pra montar o checklist de "quais dias
// trocar") — inclusivo dos dois extremos.
export function listarDiasDoPeriodo(dataInicio: string, dataFim: string): string[] {
  const dias: string[] = []
  const [yF, mF, dF] = dataFim.split('-').map(Number)
  const fim = new Date(yF, mF - 1, dF)
  let cursor = (() => {
    const [y, m, d] = dataInicio.split('-').map(Number)
    return new Date(y, m - 1, d)
  })()
  while (cursor <= fim) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    dias.push(`${y}-${m}-${d}`)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  }
  return dias
}

export function rotuloDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const data = new Date(y, m - 1, d)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} (${DIAS_SEMANA_ABREV[data.getDay()]})`
}

// Radio "escala inteira / dias específicos" + checklist de dias — usado em
// qualquer lado de qualquer tipo de troca (direta de admin/gestor, ou
// pedido/proposta entre colegas) onde a pessoa escolhe livremente o que
// está oferecendo.
export function SeletorPeriodoOuDias({
  nomeGrupo, tipo, setTipo, dias, setDias, dataInicio, dataFim,
}: {
  nomeGrupo: string
  tipo: 'completa' | 'dias'
  setTipo: (v: 'completa' | 'dias') => void
  dias: string[]
  setDias: Dispatch<SetStateAction<string[]>>
  dataInicio: string
  dataFim: string
}) {
  return (
    <>
      <div className="form-group">
        <div className="troca-tipo-opcoes">
          <label>
            <input type="radio" name={nomeGrupo} checked={tipo === 'completa'} onChange={() => setTipo('completa')} />
            Escala inteira
          </label>
          <label>
            <input type="radio" name={nomeGrupo} checked={tipo === 'dias'} onChange={() => setTipo('dias')} />
            Dias específicos
          </label>
        </div>
      </div>
      {tipo === 'dias' && (
        <div className="form-group">
          <div className="troca-dias-checklist">
            {listarDiasDoPeriodo(dataInicio, dataFim).map(dia => (
              <label key={dia} className="troca-dias-checklist-item">
                <input
                  type="checkbox"
                  checked={dias.includes(dia)}
                  onChange={(e) => {
                    setDias(atual => e.target.checked ? [...atual, dia] : atual.filter(d => d !== dia))
                  }}
                />
                {rotuloDia(dia)}
              </label>
            ))}
          </div>
          {dias.length === 0 && <small className="auto-campo-alerta">Marque pelo menos um dia.</small>}
        </div>
      )}
    </>
  )
}

// Só o checklist de dias, sem opção de "escala inteira" — usado no lado que
// abre uma troca com equivalência obrigatória (direta de admin/gestor, ou
// proposta mútua entre colegas): "escala inteira" deixava passar troca
// desproporcional sempre que os dois períodos originais já tinham tamanhos
// diferentes (ex: trocar uma escala de 3 dias pela de 2 de outra pessoa,
// inteiras, sem ninguém escolher isso de propósito). Marcando dia a dia,
// quem abre a troca sempre sabe exatamente quantos dias está oferecendo.
export function SeletorDiasSimples({
  dias, setDias, dataInicio, dataFim,
}: {
  dias: string[]
  setDias: Dispatch<SetStateAction<string[]>>
  dataInicio: string
  dataFim: string
}) {
  return (
    <div className="form-group">
      <div className="troca-dias-checklist">
        {listarDiasDoPeriodo(dataInicio, dataFim).map(dia => (
          <label key={dia} className="troca-dias-checklist-item">
            <input
              type="checkbox"
              checked={dias.includes(dia)}
              onChange={(e) => {
                setDias(atual => e.target.checked ? [...atual, dia] : atual.filter(d => d !== dia))
              }}
            />
            {rotuloDia(dia)}
          </label>
        ))}
      </div>
      {dias.length === 0 && <small className="auto-campo-alerta">Marque pelo menos um dia.</small>}
    </div>
  )
}

// Checklist do outro lado de uma troca com equivalência obrigatória: precisa
// ter exatamente a mesma quantidade de dias que o primeiro lado já marcou
// (limite) — assim que atinge esse número, as caixinhas restantes ficam
// desabilitadas, pra ficar impossível marcar a mais.
export function SeletorDiasProporcional({
  dias, setDias, dataInicio, dataFim, limite,
}: {
  dias: string[]
  setDias: Dispatch<SetStateAction<string[]>>
  dataInicio: string
  dataFim: string
  limite: number
}) {
  const completo = dias.length === limite
  return (
    <div className="form-group">
      <div className="troca-dias-checklist">
        {listarDiasDoPeriodo(dataInicio, dataFim).map(dia => {
          const marcado = dias.includes(dia)
          const travado = !marcado && dias.length >= limite
          return (
            <label key={dia} className={`troca-dias-checklist-item${travado ? ' troca-dias-checklist-item-travado' : ''}`}>
              <input
                type="checkbox"
                checked={marcado}
                disabled={travado}
                onChange={(e) => {
                  setDias(atual => e.target.checked ? [...atual, dia] : atual.filter(d => d !== dia))
                }}
              />
              {rotuloDia(dia)}
            </label>
          )
        })}
      </div>
      <small className={completo ? 'troca-dias-contagem-ok' : 'auto-campo-alerta'}>
        {dias.length} de {limite} dia{limite === 1 ? '' : 's'} selecionado{dias.length === 1 ? '' : 's'}
      </small>
    </div>
  )
}
