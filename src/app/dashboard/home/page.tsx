'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper } from 'lucide-react'
import { useDashboardUser } from '../../../context/DashboardUserContext'
import { ehPerfilGestao, rotaInicialPorPerfil, labelPerfil, labelEquipe } from '../../../lib/equipesConfig'
import type { ItemAniversariante } from '../../../types/dominio'

const semEmoji = (texto: string | null | undefined) => (texto ?? '').replace(/^[^\p{L}]+/u, '')

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// Só o primeiro nome + sobrenome, pra não poluir um card pequeno com nome
// completo (igual já é feito no mapa de baias).
function nomeCurto(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/)
  return partes.length > 1 ? `${partes[0]} ${partes[1]}` : (partes[0] ?? '')
}

function AniversariantesDoMes() {
  const [itens, setItens] = useState<ItemAniversariante[] | null>(null)

  useEffect(() => {
    let cancelado = false
    fetch('/api/integracao/aniversariantes')
      .then(res => (res.ok ? res.json() : []))
      .then((dados: ItemAniversariante[]) => { if (!cancelado) setItens(dados) })
      .catch(() => { if (!cancelado) setItens([]) })
    return () => { cancelado = true }
  }, [])

  if (!itens || itens.length === 0) return null

  const mesAtual = NOMES_MES[new Date().getMonth()]

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-brand">
        <PartyPopper size={16} /> Aniversariantes de {mesAtual}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {itens.map(item => (
          <li
            key={item.chapa}
            className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm ${item.hoje ? 'bg-brand/10 font-bold text-brand' : 'text-slate-600'}`}
          >
            <span>{item.hoje && '🎉 '}{nomeCurto(item.nome)}</span>
            <span className="text-xs text-slate-400">dia {String(item.dia).padStart(2, '0')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function DashboardHome() {
  const router = useRouter()
  const { userData } = useDashboardUser()
  const ehColaborador = userData && !ehPerfilGestao(userData.role)

  // O painel é da gestão; colaborador nem tem esse item no menu, então se
  // chegar aqui (link antigo, digitando a URL) vai pra tela dele.
  useEffect(() => {
    if (ehColaborador) {
      router.replace(rotaInicialPorPerfil(userData.role))
    }
  }, [ehColaborador, userData, router])

  if (ehColaborador) return null

  return (
    <div className="page-home">
      <header className="mb-8">
        <div className="mb-1 flex items-center gap-3">
          <span className="rounded-full bg-brand px-3 py-1 text-[10px] font-black uppercase text-white">
            {userData ? semEmoji(labelPerfil(userData.role)) : ''}
            {userData?.equipe ? ` · ${semEmoji(labelEquipe(userData.equipe))}` : ''}
          </span>
        </div>
        <h1 className="text-3xl font-black italic tracking-tight text-brand">
          Bem-vindo, {userData?.nome}!
        </h1>
        {/* "ao lado" só vale no computador — no celular o menu fica na
            barra de baixo, então o texto muda junto com a barra. */}
        <p className="mt-1 text-sm text-slate-400">
          Use o menu <span className="md:hidden">abaixo</span><span className="hidden md:inline">ao lado</span> para gerenciar escalas, trocas e usuários.
        </p>
      </header>

      <AniversariantesDoMes />
    </div>
  )
}
