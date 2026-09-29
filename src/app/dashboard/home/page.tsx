'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardUser } from '../../../context/DashboardUserContext'
import { ehPerfilGestao, rotaInicialPorPerfil, labelPerfil, labelEquipe } from '../../../lib/equipesConfig'

const semEmoji = (texto: string | null | undefined) => (texto ?? '').replace(/^[^\p{L}]+/u, '')

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
        <p className="mt-1 text-sm text-slate-400">
          Use o menu ao lado para gerenciar escalas, trocas e usuários.
        </p>
      </header>
    </div>
  )
}
