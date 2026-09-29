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

// Duas formas, mesma barra:
// - Computador: faixa vinho de 96px grudada na esquerda, ícone com rótulo
//   minúsculo embaixo e barra luminosa no item ativo (padrão do Argos).
// - Celular: barra inferior (o polegar alcança), itens lado a lado com
//   rolagem horizontal se não couberem, e a marca luminosa vai pro topo do
//   item. O logo e o bloco de perfil somem no celular — não cabem e não
//   ajudam em nada ali; o "Sair" vira o último item da fileira.
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
    <aside
      className="app-sidebar fixed z-50 flex bg-brand shadow-2xl
                 inset-x-0 bottom-0 w-full flex-row items-stretch border-t border-white/10
                 md:inset-x-auto md:bottom-auto md:left-0 md:top-0 md:h-full md:w-24 md:flex-col md:items-center md:border-r md:border-t-0 md:py-4"
    >
      <Link
        href="/dashboard"
        className="mb-4 hidden shrink-0 transition-transform hover:scale-105 active:scale-95 md:block"
        title="Escala TI"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white shadow-xl">
          <span className="text-base font-black tracking-tighter text-brand">FJS</span>
        </div>
      </Link>

      <nav
        className="flex min-h-0 min-w-0 flex-1 flex-row items-stretch overflow-x-auto overflow-y-hidden
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                   md:w-full md:flex-col md:gap-1 md:overflow-y-auto md:overflow-x-hidden"
      >
        {itens.map(item => {
          const ativo = pathname.startsWith(item.href)
          const Icone = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group relative flex min-w-[46px] flex-1 basis-0 flex-col items-center justify-center py-1.5 md:w-full md:flex-none md:basis-auto"
            >
              {ativo && (
                <div
                  className="absolute left-1/2 top-0 h-1.5 w-8 -translate-x-1/2 rounded-b-full bg-white shadow-[0_0_15px_#fff]
                             md:left-0 md:top-1/2 md:h-8 md:w-1.5 md:-translate-x-0 md:-translate-y-1/2 md:rounded-l-none md:rounded-r-full"
                />
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

              {/* No celular o rótulo perde o espaçamento entre letras: com
                  7 itens em 390px, "Relatórios" espaçado não cabe e a
                  barra inteira passaria a exigir rolagem lateral. */}
              <span
                className={cn(
                  'mt-1 max-w-full truncate px-0.5 text-[8px] font-black uppercase tracking-tight transition-colors md:tracking-widest',
                  ativo ? 'text-white' : 'text-white/40 group-hover:text-white'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* No celular o "Sair" entra na própria fileira de navegação; no
            computador ele fica no rodapé da faixa, junto do perfil. */}
        <button
          type="button"
          onClick={onSair}
          className="group flex min-w-[46px] flex-1 basis-0 flex-col items-center justify-center py-1.5 md:hidden"
        >
          <div className="rounded-2xl p-2.5 text-white/40 transition-all group-hover:bg-red-500/20 group-hover:text-red-400">
            <LogOut size={18} />
          </div>
          <span className="mt-1 max-w-full truncate px-0.5 text-[8px] font-black uppercase tracking-tight text-white/40">Sair</span>
        </button>
      </nav>

      <div className="hidden w-full shrink-0 space-y-3 border-t border-white/10 pt-3 md:block">
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
