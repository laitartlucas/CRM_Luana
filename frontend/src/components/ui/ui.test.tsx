// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, useConfirm } from './ConfirmDialog';
import { ErrorState, LoadingState, TableState } from './StateViews';
import { errorMessage, TOAST_DURATION_MS, ToastProvider, useToast } from './Toast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ToastDemo() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success('Salvo!')}>ok</button>
      <button onClick={() => toast.error('Deu ruim')}>erro</button>
    </>
  );
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());

  it('mostra o aviso e o remove sozinho depois do tempo', () => {
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status').textContent).toContain('Salvo!');

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.success + 10);
    });
    expect(screen.queryByText('Salvo!')).toBeNull();
  });

  it('erros usam role=alert e ficam na tela por mais tempo que os sucessos', () => {
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('erro'));
    expect(screen.getByRole('alert').textContent).toContain('Deu ruim');

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.success + 10);
    });
    expect(screen.queryByText('Deu ruim')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS.error);
    });
    expect(screen.queryByText('Deu ruim')).toBeNull();
  });

  it('o botão fechar remove o aviso na hora', () => {
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByLabelText('Fechar aviso'));
    expect(screen.queryByText('Salvo!')).toBeNull();
  });

  it('mantém no máximo 4 avisos visíveis, descartando os mais antigos', () => {
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>,
    );
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByText('ok'));
    expect(screen.getAllByRole('status')).toHaveLength(4);
  });

  it('usar fora do provider é um erro claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<ToastDemo />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe('errorMessage', () => {
  it('usa a mensagem da API (texto ou lista) e cai no texto padrão', () => {
    expect(errorMessage({ response: { data: { message: 'Já existe.' } } }, 'padrão')).toBe('Já existe.');
    expect(errorMessage({ response: { data: { message: ['a', 'b'] } } }, 'padrão')).toBe('a b');
    expect(errorMessage(new Error('rede'), 'padrão')).toBe('padrão');
    expect(errorMessage({ response: { data: { message: '' } } }, 'padrão')).toBe('padrão');
  });
});

function ConfirmDemo({ onResult }: { onResult: (value: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => onResult(await confirm({ title: 'Excluir?', message: 'Sem volta.', confirmLabel: 'Excluir', danger: true }))}
    >
      abrir
    </button>
  );
}

async function openDialog() {
  const onResult = vi.fn();
  render(
    <ConfirmProvider>
      <ConfirmDemo onResult={onResult} />
    </ConfirmProvider>,
  );
  fireEvent.click(screen.getByText('abrir'));
  await screen.findByRole('alertdialog');
  return onResult;
}

describe('ConfirmDialog', () => {
  it('mostra título e mensagem e começa com o foco em Cancelar (seguro para exclusões)', async () => {
    await openDialog();
    expect(screen.getByRole('alertdialog').textContent).toContain('Excluir?');
    expect(screen.getByRole('alertdialog').textContent).toContain('Sem volta.');
    expect(document.activeElement).toBe(screen.getByText('Cancelar'));
  });

  it('confirmar resolve true e fecha', async () => {
    const onResult = await openDialog();
    fireEvent.click(screen.getByText('Excluir', { selector: 'button' }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancelar, Esc e clique fora resolvem false', async () => {
    let onResult = await openDialog();
    fireEvent.click(screen.getByText('Cancelar'));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    cleanup();

    onResult = await openDialog();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    cleanup();

    onResult = await openDialog();
    fireEvent.click(document.querySelector('.modal-backdrop')!);
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('Tab alterna entre os dois botões sem deixar o foco escapar', async () => {
    await openDialog();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('Excluir', { selector: 'button' }));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('Cancelar'));
  });

  it('devolve o foco ao botão que abriu o diálogo', async () => {
    await openDialog();
    const opener = screen.getByText('abrir');
    opener.focus();
    fireEvent.click(screen.getByText('Cancelar'));
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});

describe('StateViews', () => {
  it('carregando é anunciado como status', () => {
    render(<LoadingState label="Buscando…" />);
    expect(screen.getByRole('status').textContent).toBe('Buscando…');
  });

  it('erro é anunciado como alerta e oferece tentar de novo', () => {
    const retry = vi.fn();
    render(<ErrorState message="Falhou." onRetry={retry} />);
    expect(screen.getByRole('alert').textContent).toContain('Falhou.');
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('erro sem retry não mostra o botão', () => {
    render(<ErrorState message="Falhou." />);
    expect(screen.queryByText('Tentar de novo')).toBeNull();
  });

  it('TableState ocupa a linha inteira', () => {
    render(
      <table>
        <tbody>
          <TableState colSpan={5}>vazio</TableState>
        </tbody>
      </table>,
    );
    expect(screen.getByText('vazio').getAttribute('colspan')).toBe('5');
  });
});
