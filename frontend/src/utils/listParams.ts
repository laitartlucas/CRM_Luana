/**
 * Estado de uma listagem (busca, filtros, ordenação, página) guardado na URL:
 * o link pode ser compartilhado, o botão "voltar" restaura a tela e recarregar
 * a página não perde o filtro. Valores iguais ao padrão não vão para a URL.
 */
export interface ListConfig {
  defaultSort: string;
  filterKeys: string[];
}

export interface ListParams {
  page: number;
  search: string;
  /** Ordenação no formato "campo:direção", ex.: "leadScore:desc". */
  sort: string;
  filters: Record<string, string>;
}

export function readListParams(sp: URLSearchParams, config: ListConfig): ListParams {
  const rawPage = Number(sp.get('page'));
  return {
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1,
    search: sp.get('q') ?? '',
    sort: sp.get('sort') ?? config.defaultSort,
    filters: Object.fromEntries(config.filterKeys.map((key) => [key, sp.get(key) ?? ''])),
  };
}

export function writeListParams(params: ListParams, config: ListConfig): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.search.trim()) sp.set('q', params.search.trim());
  if (params.sort !== config.defaultSort) sp.set('sort', params.sort);
  for (const key of config.filterKeys) {
    if (params.filters[key]) sp.set(key, params.filters[key]);
  }
  if (params.page > 1) sp.set('page', String(params.page));
  return sp;
}

/** Separa "campo:direção" nos dois parâmetros que a API espera. */
export function splitSort(sort: string): { sort: string; order: 'asc' | 'desc' | undefined } {
  const [field, direction] = sort.split(':');
  return { sort: field, order: direction === 'asc' || direction === 'desc' ? direction : undefined };
}

export function hasActiveFilters(params: ListParams): boolean {
  return params.search.trim() !== '' || Object.values(params.filters).some(Boolean);
}

/** "Mostrando 26–50 de 134". */
export function rangeText(page: number, pageSize: number, total: number): string {
  if (total === 0) return 'Nenhum resultado';
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return `Mostrando ${from}–${to} de ${total}`;
}

/** Números de página a exibir: sempre a primeira e a última, e uma janela ao redor da atual (null = "…"). */
export function pageWindow(page: number, totalPages: number, around = 1): Array<number | null> {
  const wanted = new Set([1, totalPages, page]);
  for (let i = 1; i <= around; i++) {
    wanted.add(page - i);
    wanted.add(page + i);
  }
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: Array<number | null> = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) result.push(null);
    result.push(p);
  });
  return result;
}
