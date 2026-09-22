// Configuração central de equipes, perfis e especialidades.
//
// Isso é usado tanto no front (Escalas, Usuários, Relatórios) quanto no
// backend (validação ao criar/editar usuário) — um lugar só de verdade.
//
// Pra adicionar uma equipe nova: só colocar em EQUIPES. Ela já aparece em
// todas as telas com o comportamento padrão (perfis Técnico/Analista, sem
// especialidade fixa). Só precisa mexer nos mapas abaixo se essa equipe
// nova fugir do padrão (perfil exclusivo, especialidades fixas etc).
//
// Pra adicionar um perfil novo: colocar em PERFIS (rótulo/emoji). Qualquer
// perfil que não seja admin/gestor já se comporta como colaborador no
// resto do sistema automaticamente (escalas, agenda, trocas) — não precisa
// mexer em mais nada a não ser que ele seja exclusivo de alguma equipe.

export const EQUIPES = [
  { id: 'suporte', label: '🎧 Suporte', cor: '#3498db' },
  { id: 'infraestrutura', label: '🔧 Infraestrutura', cor: '#e74c3c' },
  { id: 'sistemas', label: '💻 Sistemas', cor: '#27ae60' },
  { id: 'projetos', label: '📁 Projetos', cor: '#f39c12' },
]

// Perfis conhecidos pelo sistema. Admin também pode digitar um perfil
// totalmente novo na tela de Usuários (não precisa estar aqui pra existir).
export const PERFIS = [
  { id: 'tecnico', label: '👤 Técnico' },
  { id: 'analista', label: '📊 Analista' },
  { id: 'desenvolvedor', label: '🧑‍💻 Desenvolvedor' },
  { id: 'gestor', label: '👨‍💼 Gestor' },
  { id: 'admin', label: '🔐 Admin' },
]

// Perfis de colaborador (não-gestão) disponíveis por padrão em qualquer
// equipe que não seja listada abaixo.
const PERFIS_COLABORADOR_PADRAO = ['tecnico', 'analista']

// Só precisa entrar aqui uma equipe cujos perfis fogem do padrão.
const PERFIS_COLABORADOR_POR_EQUIPE = {
  sistemas: ['tecnico', 'analista', 'desenvolvedor'],
  projetos: ['analista'],
}

// Só precisa entrar aqui uma equipe que tem especialidade fixa.
const ESPECIALIDADES_POR_EQUIPE = {
  suporte: ['Manutenção', 'Redes', 'Sistemas N1', 'Sistemas N2', 'Aprendiz', 'Estagiário', 'Supervisor', 'Externo', 'Segurança da Informação'],
  infraestrutura: ['Analista Junior', 'Analista Pleno', 'Analista Senior'],
  sistemas: ['PEP', 'TOTVS'],
}

export function perfisColaboradorPorEquipe(equipe) {
  return PERFIS_COLABORADOR_POR_EQUIPE[equipe] || PERFIS_COLABORADOR_PADRAO
}

export function especialidadesPorEquipe(equipe) {
  return ESPECIALIDADES_POR_EQUIPE[equipe] || []
}

export function labelEquipe(equipeId) {
  return EQUIPES.find(e => e.id === equipeId)?.label || equipeId
}

export function corEquipe(equipeId) {
  return EQUIPES.find(e => e.id === equipeId)?.cor
}

export function labelPerfil(roleId) {
  return PERFIS.find(p => p.id === roleId)?.label || `👤 ${roleId}`
}
