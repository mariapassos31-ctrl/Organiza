import { SessionProvider } from 'next-auth/react'
import './globals.css'

export const metadata = {
  title: 'Escala TI - Gerenciamento de Escalas',
  description: 'Sistema de gerenciamento de escalas de técnicos de TI',
}

export const viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
