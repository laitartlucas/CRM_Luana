import { describe, expect, it } from 'vitest';
import { hasActiveFilters, pageWindow, rangeText, readListParams, splitSort, writeListParams } from './listParams';

const config = { defaultSort: 'leadScore:desc', filterKeys: ['source', 'stage'] };

describe('readListParams', () => {
  it('sem parâmetros usa os padrões', () => {
    expect(readListParams(new URLSearchParams(), config)).toEqual({
      page: 1,
      search: '',
      sort: 'leadScore:desc',
      filters: { source: '', stage: '' },
    });
  });

  it('lê busca, filtros, ordenação e página', () => {
    const sp = new URLSearchParams('q=maria&source=REEL&sort=name:asc&page=3');
    expect(readListParams(sp, config)).toEqual({
      page: 3,
      search: 'maria',
      sort: 'name:asc',
      filters: { source: 'REEL', stage: '' },
    });
  });

  it('ignora página inválida', () => {
    for (const bad of ['0', '-2', 'abc', '2.5']) {
      expect(readListParams(new URLSearchParams(`page=${bad}`), config).page).toBe(1);
    }
  });
});

describe('writeListParams', () => {
  it('não escreve valores padrão, deixando a URL limpa', () => {
    const params = readListParams(new URLSearchParams(), config);
    expect(writeListParams(params, config).toString()).toBe('');
  });

  it('faz o caminho de ida e volta', () => {
    const sp = new URLSearchParams('q=maria+souza&source=REEL&sort=name%3Aasc&page=3');
    const params = readListParams(sp, config);
    const back = writeListParams(params, config);
    expect(readListParams(back, config)).toEqual(params);
  });

  it('descarta espaços da busca e filtros vazios', () => {
    const out = writeListParams({ page: 1, search: '  ', sort: 'leadScore:desc', filters: { source: '', stage: 'LEAD' } }, config);
    expect(out.toString()).toBe('stage=LEAD');
  });
});

describe('splitSort / hasActiveFilters', () => {
  it('divide campo e direção', () => {
    expect(splitSort('name:asc')).toEqual({ sort: 'name', order: 'asc' });
    expect(splitSort('createdAt:desc')).toEqual({ sort: 'createdAt', order: 'desc' });
    expect(splitSort('name')).toEqual({ sort: 'name', order: undefined });
  });

  it('detecta filtro ou busca ativos (a ordenação não conta)', () => {
    const base = { page: 1, search: '', sort: 'name:asc', filters: { source: '' } };
    expect(hasActiveFilters(base)).toBe(false);
    expect(hasActiveFilters({ ...base, search: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...base, filters: { source: 'REEL' } })).toBe(true);
  });
});

describe('rangeText', () => {
  it('mostra a faixa da página, com a última página parcial', () => {
    expect(rangeText(1, 25, 134)).toBe('Mostrando 1–25 de 134');
    expect(rangeText(2, 25, 134)).toBe('Mostrando 26–50 de 134');
    expect(rangeText(6, 25, 134)).toBe('Mostrando 126–134 de 134');
  });

  it('sem resultados', () => {
    expect(rangeText(1, 25, 0)).toBe('Nenhum resultado');
  });
});

describe('pageWindow', () => {
  it('poucas páginas: mostra todas', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('muitas páginas: primeira, última e vizinhas, com reticências nas lacunas', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
  });

  it('não coloca reticências quando a lacuna é de uma página só', () => {
    expect(pageWindow(3, 10)).toEqual([1, 2, 3, 4, null, 10]);
  });
});
