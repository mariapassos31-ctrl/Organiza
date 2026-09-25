'use client'

import { useState } from 'react'
import type { ConfigLab } from '../../../types/dominio'

// Escolhe quem é o responsável fixo do Laboratório e quem cobre esse
// posto quando o responsável estiver de home office. Fica salvo no banco
// — trocar quem ocupa cada papel não precisa mexer em código.
export default function ConfigLaboratorio({ tecnicos, valorInicial, onSalvar, onClose }: {
  tecnicos: Array<{ uid: string; nome: string }>
  valorInicial: ConfigLab
  onSalvar: (valores: ConfigLab) => Promise<boolean> | boolean
  onClose: () => void
}) {
  const [valores, setValores] = useState<ConfigLab>(valorInicial)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [semAlteracao, setSemAlteracao] = useState(false)

  const alterado = valores.responsavelUid !== valorInicial.responsavelUid || valores.backupUid !== valorInicial.backupUid
  const mesmaPessoa = Boolean(valores.responsavelUid) && Boolean(valores.backupUid) && valores.responsavelUid === valores.backupUid

  const salvar = async () => {
    setSalvando(true)
    try {
      const ok = await onSalvar(valores)
      if (ok) onClose()
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

  return (
    <div className="modal-overlay" onClick={tentarFechar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🧪 Configurar Laboratório</h3>
          <button className="modal-close" onClick={tentarFechar}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="config-baias-explicacao">
            Nos dias em que o responsável estiver presencial, ele mesmo ocupa o Laboratório. Nos dias em que ele estiver de home office, quem aparece lá é o backup — sem precisar mexer em código pra trocar quem é quem.
          </p>

          <div className="form-group">
            <label>Responsável fixo</label>
            <select
              value={valores.responsavelUid || ''}
              onChange={(e) => setValores({ ...valores, responsavelUid: e.target.value || null })}
              disabled={salvando}
            >
              <option value="">— Ninguém —</option>
              {tecnicos.map(t => (
                <option key={t.uid} value={t.uid}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginTop: 15 }}>
            <label>Backup (cobre quando o responsável estiver de home office)</label>
            <select
              value={valores.backupUid || ''}
              onChange={(e) => setValores({ ...valores, backupUid: e.target.value || null })}
              disabled={salvando}
            >
              <option value="">— Ninguém —</option>
              {tecnicos.map(t => (
                <option key={t.uid} value={t.uid}>{t.nome}</option>
              ))}
            </select>
            {mesmaPessoa && <p className="campo-nota">⚠️ O responsável e o backup não podem ser a mesma pessoa.</p>}
          </div>
        </div>

        <div className="form-actions-modal">
          <button type="button" className="btn-secondary" onClick={tentarFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={clicarSalvar} disabled={salvando || mesmaPessoa}>
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
              <p>Você tem alterações no Laboratório que ainda não foram salvas. Se sair agora, elas serão perdidas.</p>
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
