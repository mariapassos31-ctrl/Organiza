import type { ReactNode } from "react"
import { SessionProvider } from 'next-auth/react'
import './globals.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/900.css'

export const metadata = {
  title: 'Escala TI - Gerenciamento de Escalas',
  description: 'Sistema de gerenciamento de escalas de técnicos de TI',
}

export const viewport = {
  themeColor: '#6c2b3e',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      {/* suppressHydrationWarning: extensões de navegador (ColorZilla, Grammarly
          etc.) injetam atributos no <body> antes do React hidratar — gera um
          aviso inofensivo de "tree hydrated but attributes didn't match", sem
          nenhuma relação com o código da aplicação. */}
      <body suppressHydrationWarning>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
