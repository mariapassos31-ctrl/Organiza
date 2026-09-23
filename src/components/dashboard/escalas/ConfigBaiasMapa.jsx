'use client'

import { useState } from 'react'
import { POSICOES_BAIA } from './MapaBaias'
import { PERFIS } from '../../../lib/equipesConfig'

// Janela flutuante com o mapa de verdade da sala, pra configurar qual
// perfil ocupa cada baia vendo exatamente onde ela fica (em vez de uma
// grade abstrata "Baia 1, Baia 2..."). A mesa do Supervisor ("0", já
// desenhada à parte na imagem) entra na mesma lista de baias configuráveis
// — "⭐ Supervisor" é só mais uma opção do seletor; só uma baia por vez pode
// ter essa marcação.
//
// As escolhas ficam só na tela até clicar em "Salvar" — tentar sair antes
// (✕, clicar fora, ou Cancelar) com alteração pendente pede confirmação.
export default function ConfigBaiasMapa({ baiasPerfil, onAlterarBaia, onClose }) {
  const [valores, setValores] = useState(baiasPerfil)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [semAlteracao, setSemAlteracao] = useState(false)

  const todasAsBaias = new Set([...Object.keys(baiasPerfil), ...Object.keys(valores)])
  const alterado = [...todasAsBaias].some(baia => (baiasPerfil[baia] || '') !== (valores[baia] || ''))

  const alterarValor = (baia, perfil) => {
    setValores(prev => {
      const proximo = { ...prev }
      if (perfil === 'supervisor') {
        for (const b of Object.keys(proximo)) {
          if (b !== baia && proximo[b] === 'supervisor') delete proximo[b]
        }
      }
      if (perfil) proximo[baia] = perfil
      else delete proximo[baia]
      return proximo
    })
  }

  const clicarSalvar = () => {
    if (!alterado) {
      setSemAlteracao(true)
      return
    }
    salvar()
  }

  const salvar = async () => {
    setSalvando(true)
    try {
      let tudoOk = true
      for (const baia of todasAsBaias) {
        const antes = baiasPerfil[baia] || ''
        const depois = valores[baia] || ''
        if (antes !== depois) {
          const ok = await onAlterarBaia(baia, depois)
          if (!ok) tudoOk = false
        }
      }
      if (tudoOk) onClose()
    } finally {
      setSalvando(false)
    }
  }

  const tentarFechar = () => {
    if (salvando) return
    if (alterado) {
      setConfirmandoSaida(true)
      return
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={tentarFechar}>
      <div className="modal-content modal-content-largo" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚙️ Configurar Baias</h3>
          <button className="modal-close" onClick={tentarFechar}>✕</button>
        </div>

        <p className="config-baias-explicacao" style={{ padding: '0 20px' }}>
          Passe o mouse sobre uma baia pra ver o número dela e escolha um perfil, se ela for exclusiva de alguém — só quem tem esse perfil senta lá, mesmo com outras baias livres. <strong>Estag/Aprendiz</strong> e <strong>Trainee</strong> podem ter até 2 pessoas por dia na mesma baia (uma de manhã, uma à tarde). Só uma baia pode ser a do <strong>⭐ Supervisor</strong> por vez — marcar uma nova desmarca a anterior automaticamente.
          <br />
          Depois de escolher, clique em <strong>Salvar</strong> pra aplicar.
        </p>

        <div style={{ padding: '0 20px 20px' }}>
          <div className="mapa-baias-wrapper">
            <img src="/images/mapa-baias.png" alt="Mapa da sala com as baias" className="mapa-baias-imagem" />

            {Object.entries(POSICOES_BAIA).map(([baia, pos]) => (
              <div key={baia} className="config-baia-mapa-item" style={pos}>
                <select
                  value={valores[baia] || ''}
                  disabled={salvando}
                  onChange={(e) => alterarValor(baia, e.target.value)}
                  title={baia === '0' ? 'Supervisor' : `Baia ${baia}`}
                >
                  <option value="">— Sem restrição —</option>
                  <option value="supervisor">⭐ Supervisor</option>
                  {PERFIS.filter(p => p.id !== 'admin').map(perfil => (
                    <option key={perfil.id} value={perfil.id}>{perfil.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
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
              <p>Você não mudou nenhuma baia desde que abriu essa tela.</p>
              <div className="confirm-acoes">
                <button type="button" className="btn-primary" onClick={onClose}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmandoSaida && (
          <div className="confirm-overlay" onClick={() => setConfirmandoSaida(false)}>
            <div className="confirm-caixa" onClick={(e) => e.stopPropagation()}>
              <h4>Sair sem salvar?</h4>
              <p>Você tem alterações nas baias que ainda não foram salvas. Se sair agora, elas serão perdidas.</p>
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
