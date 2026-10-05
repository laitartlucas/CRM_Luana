// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAsyncData } from './useAsyncData';

afterEach(cleanup);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsyncData', () => {
  it('carrega e entrega os dados', async () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve('ok'), []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('marca erro e permite tentar de novo', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce('agora foi');
    const { result } = renderHook(() => useAsyncData(fetcher, []));
    await waitFor(() => expect(result.current.error).toBe(true));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('agora foi'));
    expect(result.current.error).toBe(false);
  });

  it('resposta antiga não sobrescreve a mais nova quando os parâmetros mudam no meio', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const { result, rerender } = renderHook(({ period }) => useAsyncData(() => (period === 'a' ? slow.promise : fast.promise), [period]), {
      initialProps: { period: 'a' },
    });

    rerender({ period: 'b' });
    await act(async () => fast.resolve('dados de B'));
    await waitFor(() => expect(result.current.data).toBe('dados de B'));

    await act(async () => slow.resolve('dados de A (atrasados)'));
    expect(result.current.data).toBe('dados de B');
    expect(result.current.loading).toBe(false);
  });

  it('mantém os dados anteriores enquanto a nova consulta carrega', async () => {
    const second = deferred<string>();
    const fetcher = vi.fn().mockResolvedValueOnce('primeiros').mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ n }) => useAsyncData(fetcher, [n]), { initialProps: { n: 1 } });
    await waitFor(() => expect(result.current.data).toBe('primeiros'));

    rerender({ n: 2 });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toBe('primeiros');

    await act(async () => second.resolve('segundos'));
    await waitFor(() => expect(result.current.data).toBe('segundos'));
  });

  it('desabilitado não consulta e não fica em carregando', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    const { result } = renderHook(() => useAsyncData(fetcher, [], false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('resposta que chega depois de desmontar é ignorada (sem erro de estado)', async () => {
    const late = deferred<string>();
    const { unmount } = renderHook(() => useAsyncData(() => late.promise, []));
    unmount();
    await expect(act(async () => late.resolve('tarde'))).resolves.not.toThrow();
  });
});
