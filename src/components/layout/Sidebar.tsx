'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { LogOut } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ItemMenu {
  label: string
  href: string
  icon: LucideIcon
  badge?: number
}

// Barra lateral compacta no padrão do Argos: faixa vinho de 96px, ícone com
// rótulo minúsculo embaixo e barra luminosa no item ativo.
export function Sidebar({
  itens,
  usuario,
  onSair,
}: {
  itens: ItemMenu[]
  usuario: { nome: string; perfil: string }
  onSair: () => void
}) {
  const pathname = usePathname()
  const iniciais = usuario.nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0])
    .join('')
    .toUpperCase()

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-24 flex-col items-center border-r border-white/5 bg-brand py-4 shadow-2xl">
      <Link
        href="/dashboard"
        className="mb-4 shrink-0 transition-transform hover:scale-105 active:scale-95"
        title="Escala TI"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white shadow-xl">
          <span className="text-base font-black tracking-tighter text-brand">FJS</span>
        </div>
      </Link>

      <nav className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {itens.map(item => {
          const ativo = pathname.startsWith(item.href)
          const Icone = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex w-full shrink-0 flex-col items-center py-1.5"
            >
              {ativo && (
                <div className="absolute left-0 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-white shadow-[0_0_15px_#fff]" />
              )}

              <div
                className={cn(
                  'relative rounded-2xl p-2.5 transition-all duration-300',
                  ativo
                    ? 'scale-110 bg-white/15 text-white shadow-inner'
                    : 'text-white/40 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icone size={18} />
                {item.badge ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                    {item.badge}
                  </span>
                ) : null}
              </div>

              <span
                className={cn(
                  'mt-1 text-[8px] font-black uppercase tracking-widest transition-colors',
                  ativo ? 'text-white' : 'text-white/40 group-hover:text-white'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="w-full shrink-0 space-y-3 border-t border-white/10 pt-3">
        <div
          className="flex flex-col items-center"
          title={`${usuario.nome} — ${usuario.perfil}`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-black text-white">
            {iniciais || '?'}
          </div>
          <span className="mt-1 max-w-full truncate px-1 text-[8px] font-black uppercase tracking-widest text-white/50">
            {usuario.perfil}
          </span>
        </div>

        <button type="button" onClick={onSair} className="group flex w-full flex-col items-center">
          <div className="rounded-2xl p-2.5 text-white/40 transition-all group-hover:bg-red-500/20 group-hover:text-red-400">
            <LogOut size={18} />
          </div>
          <span className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-white/40">Sair</span>
        </button>
      </div>
    </aside>
  )
}
