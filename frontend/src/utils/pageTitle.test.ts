import { describe, expect, it } from 'vitest';
import { titleForPath } from './pageTitle';

describe('titleForPath', () => {
  it.each([
    ['/', 'Painel · Luana Laitart Studio'],
    ['/leads', 'Leads · Luana Laitart Studio'],
    ['/leads/abc-123', 'Lead · Luana Laitart Studio'],
    ['/clientes', 'Clientes · Luana Laitart Studio'],
    ['/clientes/abc-123', 'Cliente · Luana Laitart Studio'],
    ['/pipeline', 'Pipeline · Luana Laitart Studio'],
    ['/tarefas', 'Tarefas · Luana Laitart Studio'],
    ['/agenda', 'Agenda · Luana Laitart Studio'],
    ['/servicos', 'Serviços · Luana Laitart Studio'],
    ['/configuracoes', 'Configurações · Luana Laitart Studio'],
    ['/login', 'Entrar · Luana Laitart Studio'],
    ['/intake/c1/token', 'Ficha da cliente · Luana Laitart Studio'],
  ])('%s', (path, title) => {
    expect(titleForPath(path)).toBe(title);
  });

  it('rota desconhecida usa só o nome do app', () => {
    expect(titleForPath('/nao-existe')).toBe('Luana Laitart Studio');
  });
});
