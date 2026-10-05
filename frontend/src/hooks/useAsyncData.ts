import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carrega dados que dependem de parâmetros (período, filtros). Só a resposta da ÚLTIMA consulta
 * vale — trocar o período rápido não deixa uma resposta antiga sobrescrever a nova. Os dados
 * anteriores continuam na tela enquanto a nova consulta carrega (sem "piscar" vazio).
 * Passe `enabled: false` para não consultar (ex.: papel sem acesso).
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const latest = useRef(0);

  const load = useCallback(() => {
    const requestId = ++latest.current;
    const isLatest = () => requestId === latest.current;
    setLoading(true);
    setError(false);
    fetcher()
      .then((result) => isLatest() && setData(result))
      .catch(() => isLatest() && setError(true))
      .finally(() => isLatest() && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (enabled) load();
    else setLoading(false);
    return () => {
      latest.current++; // desmontou ou mudou de parâmetros: descarta o que ainda estiver em voo
    };
  }, [load, enabled]);

  return { data, loading, error, reload: load };
}
