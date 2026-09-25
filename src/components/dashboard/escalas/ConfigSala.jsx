'use client'

import { useState } from 'react'
import { POSICOES_BAIA } from './MapaBaias'
import { labelEquipe, PERFIS, especialidadesPorEquipe } from '../../../lib/equipesConfig'
import { IMAGEM_COM_POSICOES_CONHECIDAS } from '../../../lib/salasConfig'

function valorVazio(sala) {
  return sala.modoReserva === 'equipe' ? { equipe: '', especialidade: '' } : { perfil: '' }
}

function baiasIguais(a, b, modoReserva) {
  if (modoReserva === 'equipe') {
    return (a?.equipe || '') === (b?.equipe || '') && (a?.especialidade || '') === (b?.especialidade || '')
  }
  return (a?.perfil || '') === (b?.perfil || '')
}

// Configuração de uma Sala — se ela tiver a imagem conhecida do Suporte,
// mostra o mapa visual; senão, uma lista simples. O modo de reserva (por
// perfil ou por equipe) já vem pronto da API, calculado pela quantidade
// de equipes vinculadas à sala.
export default function ConfigSala({ sala, minhaEquipe, souAdmin, onAlterarBaia, onClose }) {
  const [valores, setValores] = useState(sala.baias)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [semAlteracao, setSemAlteracao] = useState(false)

  const mostrarMapa = sala.imagem === IMAGEM_COM_POSICOES_CONHECIDAS
  const numerosBaia = mostrarMapa
    ? Object.keys(POSICOES_BAIA)
    : Array.from({ length: sala.qtdBaias || 9 }, (_, i) => String(i + 1))
  const equipesQuePossoEscolher = souAdmin ? sala.equipes : sala.equipes.filter(e => e === minhaEquipe)

  const todasAsBaias = new Set([...Object.keys(sala.baias), ...Object.keys(valores)])
  const alterado = [...todasAsBaias].some(baia => !baiasIguais(sala.baias[baia], valores[baia], sala.modoReserva))

  const alterarPerfil = (baia, perfil) => {
    setValores(prev => {
      const proximo = { ...prev }
      if (perfil) proximo[baia] = { perfil }
      else delete proximo[baia]
      return proximo
    })
  }

  const alterarEquipe = (baia, equipe) => {
    setValores(prev => {
      const proximo = { ...prev }
      if (equipe) proximo[baia] = { equipe, especialidade: '' }
      else delete proximo[baia]
      return proximo
    })
  }

  const alterarEspecialidade = (baia, especialidade) => {
    setValores(prev => ({ ...prev, [baia]: { ...prev[baia], especialidade } }))
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      let tudoOk = true
      for (const baia of todasAsBaias) {
        const antes = sala.baias[baia] || valorVazio(sala)
        const depois = valores[baia] || valorVazio(sala)
        if (!baiasIguais(antes, depois, sala.modoReserva)) {
          const ok = sala.modoReserva === 'equipe'
            ? await onAlterarBaia(baia, { equipe: depois.equipe || null, especialidade: depois.especialidade || null })
            : await onAlterarBaia(baia, { perfil: depois.perfil || null })
          if (!ok) tudoOk = false
        }
      }
      if (tudoOk) onClose()
    } finally {
      setSalvando(false)
    }
  }

  const clicarSalvar = () => {
    if (!alterado) {
      setSemAlteracao(true)
      return
    }
    salvar()
  }

  const tentarFechar = () => {
    if (salvando) return
    if (alterado) {
      setConfirmandoSaida(true)
      return
    }
    onClose()
  }

  const renderCampos = (baia) => {
    const valor = valores[baia] || valorVazio(sala)

    if (sala.modoReserva === 'perfil') {
      return (
        <select
          value={valor.perfil || ''}
          disabled={salvando}
          onChange={(e) => alterarPerfil(baia, e.target.value)}
          title={baia === '0' ? 'Supervisor' : `Baia ${baia}`}
        >
          <option value="">— Sem restrição —</option>
          <option value="supervisor">⭐ Supervisor</option>
          {PERFIS.filter(p => p.id !== 'admin').map(perfil => (
            <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
          ))}
        </select>
      )
    }

    const donoOutraEquipe = valor.equipe && !equipesQuePossoEscolher.includes(valor.equipe)
    if (donoOutraEquipe) {
      return (
        <span className="config-baia-linha-travada">
          🔒 {labelEquipe(valor.equipe)}{valor.especialidade ? ` · ${valor.especialidade}` : ' · qualquer um da equipe'}
        </span>
      )
    }

    const especialidadesDaEquipe = valor.equipe ? especialidadesPorEquipe(valor.equipe) : []
    return (
      <>
        <select value={valor.equipe || ''} disabled={salvando} onChange={(e) => alterarEquipe(baia, e.target.value)}>
          <option value="">— Livre —</option>
          {equipesQuePossoEscolher.map(eq => (
            <option key={eq} value={eq}>{labelEquipe(eq)}</option>
          ))}
        </select>
        {valor.equipe && (
          <select value={valor.especialidade || ''} disabled={salvando} onChange={(e) => alterarEspecialidade(baia, e.target.value)}>
            <option value="">— Qualquer especialidade da equipe —</option>
            {especialidadesDaEquipe.map(esp => (
              <option key={esp} value={esp}>{esp}</option>
            ))}
          </select>
        )}
      </>
    )
  }

  return (
    <div className="modal-overlay" onClick={tentarFechar}>
      <div className={`modal-content ${mostrarMapa ? 'modal-content-largo' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🏢 {sala.nome}</h3>
          <button className="modal-close" onClick={tentarFechar}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">
            {sala.modoReserva === 'equipe' ? (
              <>Essa sala é dividida por {sala.equipes.map(labelEquipe).join(', ')}. Cada gestor só reivindica baia livre ou já reivindicada pela própria equipe — baias de outra equipe aparecem travadas. Escolha a equipe e, se quiser, uma especialidade específica dela.</>
            ) : (
              <>Escolha, pra cada baia, se ela é exclusiva de algum perfil (ou do Supervisor). Baias de <strong>Estag/Aprendiz</strong> ou <strong>Trainee</strong> comportam até 2 pessoas por dia (manhã e tarde). Só uma baia pode ser a do <strong>⭐ Supervisor</strong> por vez.</>
            )}
            <br />
            Cada escolha só salva quando você clicar em <strong>Salvar</strong>.
          </p>

          {mostrarMapa ? (
            <div className="mapa-baias-wrapper">
              <img src={sala.imagem} alt={`Mapa da ${sala.nome}`} className="mapa-baias-imagem" />
              {numerosBaia.map(baia => (
                <div key={baia} className="config-baia-mapa-item" style={POSICOES_BAIA[baia]}>
                  {renderCampos(baia)}
                </div>
              ))}
            </div>
          ) : (
            <div className="config-baias-lista">
              {numerosBaia.map(baia => (
                <div key={baia} className="config-baia-linha">
                  <span className="config-baia-linha-numero">Baia {baia}</span>
                  {renderCampos(baia)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={tentarFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={clicarSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : '💾 Salvar'}
          </button>
        </div>

        {semAlteracao && (
          <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Nenhuma alteração pra salvar</h4>
              <p>Você não mudou nada desde que abriu essa tela.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-primary" onClick={onClose}>OK</button>
              </div>
            </div>
          </div>
        )}

        {confirmandoSaida && (
          <div className="confirm-overlay" onClick={() => setConfirmandoSaida(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Sair sem salvar?</h4>
              <p>Você tem alterações em "{sala.nome}" que ainda não foram salvas. Se sair agora, elas serão perdidas.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-secondary" onClick={() => setConfirmandoSaida(false)}>
                  Continuar editando
                </button>
                <button type="button" className="btn-deletar" onClick={onClose}>
                  Sair sem salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
