// Imagem do mapa da sala do Suporte, com posições de cada baia já
// definidas em MapaBaias.jsx (baias 0 a 9, incluindo a mesa do
// Supervisor). Compartilhada entre client (ConfigSala) e server (rota de
// equipes da sala) porque as duas precisam saber reconhecer essa mesma
// imagem: o client pra mostrar o mapa visual e travar a seleção a 1
// equipe só; o server pra validar isso de verdade.
export const IMAGEM_COM_POSICOES_CONHECIDAS = '/images/mapa-baias.png'
