import 'server-only'
import { query } from './db'

// A tabela `escalas` não tem coluna de "apagada em" nem "está na lixeira"
// (o usuário do banco não tem permissão de ALTER TABLE nesse schema, então
// não dá pra criar uma) — por isso o soft-delete reaproveita duas colunas
// já existentes: `tp_status = 'cancelada'` (um valor que a aplicação nunca
// grava sozinha, só existe pra isso) marca que está na lixeira, e
// `dt_atualizacao` (sempre tocada junto) vira o carimbo de quando foi
// apagada, usado pra contar os 7 dias de prazo. (cd_grupo_escala parecia
// livre à primeira vista, mas tem uma FK de verdade pra grupos_escala —
// não dá pra reaproveitar pra guardar "quem apagou" sem violar isso.)
export const PRAZO_LIXEIRA_DIAS = 7

// Chamado sempre que a lixeira é aberta — como não dá pra agendar um job no
// banco, o expurgo é "preguiçoso": só acontece quando alguém efetivamente
// olha a tela (o prazo real de quem nunca abre a lixeira pode passar um
// pouco de 7 dias, mas isso não importa pra ninguém).
export async function purgarLixeiraExpirada(): Promise<void> {
  await query(
    `DELETE FROM escalas WHERE tp_status = 'cancelada' AND dt_atualizacao < now() - ($1 || ' days')::interval`,
    [PRAZO_LIXEIRA_DIAS]
  )
}
