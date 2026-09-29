export function mensagemDeErro(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Código SQLSTATE do Postgres (ex: '23505' = violação de unique), se houver.
export function codigoPg(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined
}
