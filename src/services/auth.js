export const registerUser = async (email, password, displayName) => {
  const response = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: displayName,
      email,
      senha: password,
      role: 'tecnico',
      equipe: 'suporte',
    }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Falha ao criar usuário')
  }

  return response.json()
}
