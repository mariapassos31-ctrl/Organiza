import { redirect } from 'next/navigation'
import { auth } from '../../auth'
import { rotaInicialPorPerfil } from '../../lib/equipesConfig'

export default async function DashboardIndex() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  redirect(rotaInicialPorPerfil(session.user.role))
}
