import 'server-only'

// Mapeia o TIME que vem da VW_TIME (RH/Oracle, via colaboradorRHApi) pra
// equipe do Organiza — confirmado batendo no endpoint de verdade em
// 2026-10: SUPORTE (29 pessoas), SISTEMAS (18), INFRA (5), PROJETOS (3) e
// DADOS (6) batem direto. Os outros 4 valores que aparecem lá (SUPERVISAO
// TIC, COORDENACAO TIC, GERENCIA TIC, SEGURANCA DA INFORMACAO — 8 pessoas)
// são cargos de liderança/área que transitam entre equipes: não dá pra
// saber a equipe certa só pelo nome, ficam de fora de propósito — quem
// sincroniza continua sem equipe automática, completa no "✏️ Editar".
export const MAPA_TIME_RH_PARA_EQUIPE: Record<string, string> = {
  SUPORTE: 'suporte',
  INFRA: 'infraestrutura',
  SISTEMAS: 'sistemas',
  PROJETOS: 'projetos',
  DADOS: 'dados',
}

export function equipeDoTimeRh(time: string | null | undefined): string | null {
  if (!time) return null
  return MAPA_TIME_RH_PARA_EQUIPE[time.trim().toUpperCase()] ?? null
}
