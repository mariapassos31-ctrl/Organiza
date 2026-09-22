'use client'

import { useState } from 'react'
import { useDashboardUser } from '../../context/DashboardUserContext'
import '../../styles/ManualUso.css'

function Secao({ titulo, children }) {
  return (
    <div className="manual-secao">
      <h3>{titulo}</h3>
      {children}
    </div>
  )
}

function ManualGestor() {
  return (
    <>
      <Secao titulo="👥 Usuários">
        <p>Cadastre e edite técnicos e analistas: nome, e-mail, perfil, equipe, especialidade, horário de entrada, baia e férias.</p>
        <ul>
          <li><strong>Baia:</strong> escolha um número de 1 a 9, ou a baia especial <strong>⭐ Supervisor</strong> — quem for colocado nela fica automaticamente fixo, aparece na caixa "SUPERVISOR" do mapa da sala e nunca entra em nenhuma escala (nem presencial, nem home office).</li>
          <li><strong>Baia fixa:</strong> a pessoa sempre volta pro mesmo lugar quando está presencial; quando ela está de folga/home office, a baia fica livre pra outra pessoa usar naquele dia.</li>
          <li><strong>Home office suspenso:</strong> desliga a pessoa do rodízio de home office. Ao ligar esse interruptor, o sistema recalcula sozinho os dias futuros da equipe pra continuar com a quantidade certa de pessoas em home office por dia.</li>
          <li><strong>Dia do curso:</strong> só aparece pra especialidade Aprendiz — marque o dia da semana do curso e, nesse dia, a pessoa aparece como "🎓 Curso" em vez de presencial (e não ocupa baia).</li>
          <li>Só quem é <strong>gestor</strong> pode editar o próprio cadastro. Técnico/analista nunca edita o próprio perfil — só pode pedir troca de escala.</li>
        </ul>
      </Secao>

      <Secao titulo="📅 Escalas — visão geral">
        <ul>
          <li>Filtre por equipe e por técnico/analista específico no topo da tela.</li>
          <li>Clique na lupa 🔍 ao lado do número do dia pra ver todo mundo escalado naquele dia — dá pra navegar pro dia anterior/seguinte sem fechar o modal.</li>
          <li>Pra equipe Suporte, esse modal também mostra o <strong>mapa das baias</strong> e quem está em home office/férias/curso naquele dia.</li>
          <li>Dias de <strong>feriado</strong> (nacional, Bahia ou Salvador) aparecem destacados no calendário com o nome do feriado, e o sistema nunca gera escala neles.</li>
          <li>O switch "Ver escalas detalhadas", no fim da página, mostra a lista completa em formato de tabela (fica escondida por padrão pra não poluir a tela).</li>
        </ul>
      </Secao>

      <Secao titulo="🪄 Gerando uma nova escala">
        <p>Clique em <strong>"Nova Escala"</strong> e siga os 4 passos do assistente:</p>
        <ol>
          <li><strong>Tipo:</strong> Presencial + Home Office (híbrido), Escala Sábado (só Suporte) ou Sobreaviso.</li>
          <li><strong>Técnicos:</strong> escolha quem participa. Analista e Aprendiz nunca aparecem pra Sábado; quem está na baia do Supervisor nunca aparece em nenhum tipo.</li>
          <li><strong>Regras:</strong> dias de trabalho da semana e, no modo híbrido, como decidir quem fica em home office — por porcentagem ou por <strong>quantidade fixa</strong> (ex: sempre 2 pessoas por dia, trocando a dupla a cada X dias). No modo quantidade fixa, o sistema nunca repete especialidade nem coloca 2 pessoas que entram às 7h juntas, e evita repetir a mesma dupla de baia.</li>
          <li><strong>Confirmar:</strong> revise a prévia (dá pra trocar o técnico de um dia específico ou remover uma escala antes de confirmar) e gere.</li>
        </ol>
      </Secao>

      <Secao titulo="🔄 Trocas">
        <p>Acompanhe as solicitações de troca entre técnicos/analistas da equipe (ou de todas as equipes, se for admin). Gestor não aprova troca manualmente — a troca acontece direto entre quem pede e quem recebe.</p>
      </Secao>

      <Secao titulo="📈 Relatórios">
        <p>Métricas de ocupação, distribuição de home office/presencial e outros indicadores da equipe.</p>
      </Secao>
    </>
  )
}

function ManualTecnico() {
  return (
    <>
      <Secao titulo="📅 Escalas">
        <ul>
          <li>Veja o calendário da sua equipe inteira, não só o seu. Use <strong>"Filtrar por Técnico/Analista"</strong> pra ver só os dias de uma pessoa (inclusive os seus).</li>
          <li>Clique na lupa 🔍 do número do dia pra ver todo mundo escalado naquele dia — e, se for da equipe Suporte, o mapa de baias.</li>
          <li>Clique diretamente numa escala (sua ou de um colega) pra abrir os detalhes dela.</li>
        </ul>
      </Secao>

      <Secao titulo="🔄 Solicitando uma troca">
        <p>Abra a escala <strong>que é sua</strong> e clique em <strong>"🔄 Solicitar Troca"</strong>:</p>
        <ul>
          <li>Escolha se quer trocar a <strong>escala inteira</strong> ou <strong>só um dia</strong> dela.</li>
          <li>Escolha o colega da sua equipe com quem quer trocar.</li>
          <li>Envie — a solicitação aparece pra ele(a) na aba "Trocas".</li>
        </ul>
        <p>Dica: se você quer especificamente o dia de um colega, dá pra abrir a escala dele(a) primeiro (filtrando por ele(a) ou clicando direto no calendário) só pra conferir o período — depois volte na sua própria escala pra mandar o pedido de troca.</p>
      </Secao>

      <Secao titulo="🔄 Aba Trocas">
        <ul>
          <li><strong>📥 Recebidas:</strong> pedidos de troca que colegas te enviaram — aceite ou recuse.</li>
          <li><strong>📤 Minhas solicitações:</strong> acompanhe o status dos pedidos que você enviou (pendente, aceita, recusada) — dá pra cancelar enquanto estiver pendente.</li>
        </ul>
      </Secao>

      <Secao titulo="⚠️ O que você não pode fazer">
        <ul>
          <li>Não é possível editar seu próprio cadastro (perfil, baia, especialidade, home office, etc.) — isso é só do gestor.</li>
          <li>Não é possível gerar ou editar escalas diretamente — só solicitar troca com um colega.</li>
        </ul>
      </Secao>
    </>
  )
}

export default function ManualUso() {
  const { userData } = useDashboardUser()
  const ehGestorOuAdmin = userData?.role === 'admin' || userData?.role === 'gestor'
  const [aba, setAba] = useState(ehGestorOuAdmin ? 'gestor' : 'tecnico')

  return (
    <div className="manual-container">
      <div className="manual-header">
        <h2>📖 Manual de Uso</h2>
        <p className="subtitle">Como usar o Escala TI, de acordo com o seu perfil</p>
      </div>

      <div className="manual-abas">
        <button
          className={`manual-aba ${aba === 'gestor' ? 'ativa' : ''}`}
          onClick={() => setAba('gestor')}
        >
          👔 Gestor
        </button>
        <button
          className={`manual-aba ${aba === 'tecnico' ? 'ativa' : ''}`}
          onClick={() => setAba('tecnico')}
        >
          🧑‍💻 Técnico / Analista
        </button>
      </div>

      <div className="manual-conteudo">
        {aba === 'gestor' ? <ManualGestor /> : <ManualTecnico />}
      </div>
    </div>
  )
}
