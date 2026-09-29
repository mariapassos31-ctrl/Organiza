'use client'

import type { Dispatch, ReactNode, SetStateAction } from 'react'

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

// Checklist de dias com uma lista fixa de candidatos (em vez de um único
// período contínuo) e um rótulo extra por dia — usado na troca direta, onde
// cada dia pode ter uma escala de cada uma das duas pessoas envolvidas (não
// dá pra amarrar num período só). Mostrar o que cada um já tem, dia a dia,
// evita ter que escolher "de quem é a escala" separadamente.
export function SeletorDiasComPreVia({
  dias, setDias, diasCandidatos, limite, rotulo,
}: {
  dias: string[]
  setDias: Dispatch<SetStateAction<string[]>>
  diasCandidatos: string[]
  // Sem limite: seleção livre, qualquer quantidade (caso da troca direta,
  // onde cada dia já resolve sozinho, sem precisar bater com outro lado).
  // Com limite: trava em cima de uma quantidade certa (caso da troca
  // mútua, onde os dois lados precisam ser equivalentes).
  limite?: number
  rotulo: (dia: string) => string
}) {
  return (
    <div className="form-group">
      <div className="troca-dias-checklist troca-dias-checklist-previa">
        {diasCandidatos.length === 0 && (
          <small className="campo-nota">Nenhum dia com escala física encontrado pra essas duas pessoas.</small>
        )}
        {diasCandidatos.map(dia => {
          const marcado = dias.includes(dia)
          const travado = limite != null && !marcado && dias.length >= limite
          return (
            <label key={dia} className={`troca-dias-checklist-item troca-dias-checklist-item-previa${travado ? ' troca-dias-checklist-item-travado' : ''}`}>
              <input
                type="checkbox"
                checked={marcado}
                disabled={travado}
                onChange={(e) => {
                  setDias(atual => e.target.checked ? [...atual, dia] : atual.filter(d => d !== dia))
                }}
              />
              <span>
                <strong>{rotuloDia(dia)}</strong>
                <small>{rotulo(dia)}</small>
              </span>
            </label>
          )
        })}
      </div>
      {diasCandidatos.length > 0 && limite != null && (
        <small className={dias.length === limite ? 'troca-dias-contagem-ok' : 'auto-campo-alerta'}>
          {dias.length} de {limite} dia{limite === 1 ? '' : 's'} selecionado{dias.length === 1 ? '' : 's'}
        </small>
      )}
      {diasCandidatos.length > 0 && limite == null && dias.length > 0 && (
        <small className="troca-dias-contagem-ok">
          {dias.length} dia{dias.length === 1 ? '' : 's'} selecionado{dias.length === 1 ? '' : 's'}
        </small>
      )}
    </div>
  )
}

// Layout "De/Para" — dois painéis lado a lado com um ícone de troca no
// meio, pra deixar o conceito de permuta cruzada óbvio visualmente (em vez
// de depender de parágrafo explicando quem cede o quê). Cada tela
// preenche os painéis com os próprios campos (select, checklist) — isso
// aqui é só o esqueleto visual.
export function PainelDeParaTroca({ esquerda, direita }: { esquerda: ReactNode; direita: ReactNode }) {
  return (
    <div className="de-para-troca">
      <div className="de-para-painel">{esquerda}</div>
      <div className="de-para-icone" aria-hidden="true">🔄</div>
      <div className="de-para-painel">{direita}</div>
    </div>
  )
}

