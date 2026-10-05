// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary, isChunkLoadError } from './ErrorBoundary';

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

beforeEach(() => {
  // React registra o erro capturado no console; não polui a saída dos testes.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('sem erro, mostra o conteúdo normalmente', () => {
    render(
      <ErrorBoundary>
        <p>tudo certo</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('tudo certo')).toBeTruthy();
  });

  it('erro qualquer: mensagem genérica anunciada como alerta, com botão de recarregar', () => {
    render(
      <ErrorBoundary>
        <Boom message="quebrou" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Algo deu errado');
    expect(screen.getByText('Recarregar a página')).toBeTruthy();
  });

  it('erro de carregamento de arquivo explica que o sistema foi atualizado', () => {
    render(
      <ErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/Leads-abc123.js" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('O sistema foi atualizado');
  });

  it('o botão recarrega a página', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true });
    render(
      <ErrorBoundary>
        <Boom message="quebrou" />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Recarregar a página'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/a.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'Loading chunk 12 failed.',
  ])('reconhece: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('não confunde erros comuns', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
