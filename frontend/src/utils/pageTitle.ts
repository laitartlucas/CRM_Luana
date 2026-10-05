const APP_NAME = 'Luana Laitart Studio';

const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, 'Painel'],
  [/^\/leads\/[^/]+$/, 'Lead'],
  [/^\/leads$/, 'Leads'],
  [/^\/pipeline$/, 'Pipeline'],
  [/^\/tarefas$/, 'Tarefas'],
  [/^\/agenda$/, 'Agenda'],
  [/^\/clientes\/[^/]+$/, 'Cliente'],
  [/^\/clientes$/, 'Clientes'],
  [/^\/servicos$/, 'Serviços'],
  [/^\/configuracoes$/, 'Configurações'],
  [/^\/login$/, 'Entrar'],
  [/^\/intake\//, 'Ficha da cliente'],
];

/**
 * Título da aba para cada rota. Em um app de página única o título não muda sozinho; sem isto, leitores de
 * tela anunciam o mesmo nome em toda navegação e o histórico/abas do navegador ficam todos iguais.
 */
export function titleForPath(pathname: string): string {
  const match = TITLES.find(([pattern]) => pattern.test(pathname));
  return match ? `${match[1]} · ${APP_NAME}` : APP_NAME;
}
