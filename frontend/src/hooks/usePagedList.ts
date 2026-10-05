import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Paginated } from '../api/types';
import { hasActiveFilters, ListConfig, ListParams, readListParams, splitSort, writeListParams } from '../utils/listParams';

export interface PagedQuery {
  page: number;
  search: string;
  sort: string;
  order: 'asc' | 'desc' | undefined;
  filters: Record<string, string>;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Listagem paginada com busca, filtros e ordenação guardados na URL.
 * - O campo de busca é controlado localmente e só vai para a URL/consulta após uma pausa na digitação.
 * - Mudar busca, filtro ou ordenação volta para a página 1.
 * - Só a resposta da última consulta vale (trocar filtros rápido não mistura resultados).
 * - Se a página atual esvaziar (ex.: excluiu o último item dela), volta uma página.
 */
export function usePagedList<T>(config: ListConfig, fetcher: (query: PagedQuery) => Promise<Paginated<T>>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => readListParams(searchParams, config), [searchParams, config]);

  const [searchInput, setSearchInput] = useState(params.search);
  const [data, setData] = useState<Paginated<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const latest = useRef(0);

  const update = useCallback(
    (patch: Partial<ListParams>, resetPage = true) => {
      const next: ListParams = { ...params, ...patch, page: patch.page ?? (resetPage ? 1 : params.page) };
      setSearchParams(writeListParams(next, config), { replace: true });
    },
    [params, config, setSearchParams],
  );

  // Digitação -> URL, com pausa. Também sincroniza quando a URL muda por fora (voltar/avançar).
  useEffect(() => {
    if (searchInput.trim() === params.search.trim()) return;
    const timeout = setTimeout(() => update({ search: searchInput }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput, params.search, update]);
  useEffect(() => {
    setSearchInput(params.search);
  }, [params.search]);

  const filtersKey = JSON.stringify(params.filters);
  const load = useCallback(() => {
    const requestId = ++latest.current;
    const isLatest = () => requestId === latest.current;
    setLoading(true);
    setError(false);
    const { sort, order } = splitSort(params.sort);
    fetcher({ page: params.page, search: params.search.trim(), sort, order, filters: params.filters })
      .then((result) => isLatest() && setData(result))
      .catch(() => isLatest() && setError(true))
      .finally(() => isLatest() && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.page, params.search, params.sort, filtersKey]);

  useEffect(load, [load]);

  // Página vazia depois de excluir: volta para a última página que ainda existe.
  // Só vale para o resultado da página atual da URL — o vazio antigo, ainda em memória
  // enquanto a página nova carrega, faria o ajuste disparar de novo e descer demais.
  useEffect(() => {
    if (!loading && data && data.page === params.page && data.items.length === 0 && params.page > 1) {
      update({ page: Math.min(params.page - 1, data.totalPages) }, false);
    }
  }, [loading, data, params.page, update]);

  return {
    params,
    data,
    loading,
    error,
    reload: load,
    searchInput,
    setSearchInput,
    setFilter: (key: string, value: string) => update({ filters: { ...params.filters, [key]: value } }),
    setSort: (sort: string) => update({ sort }),
    setPage: (page: number) => update({ page }, false),
    clearAll: () => {
      setSearchInput('');
      update({ search: '', filters: Object.fromEntries(config.filterKeys.map((k) => [k, ''])) });
    },
    filtersActive: hasActiveFilters(params),
  };
}
