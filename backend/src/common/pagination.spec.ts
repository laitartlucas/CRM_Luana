import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, PaginationQueryDto, resolvePage, toPage } from './pagination';

describe('resolvePage', () => {
  it('usa página 1 e o tamanho padrão quando nada é informado', () => {
    expect(resolvePage({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0, take: DEFAULT_PAGE_SIZE });
  });

  it('calcula o deslocamento da página', () => {
    expect(resolvePage({ page: 3, pageSize: 10 })).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 });
  });

  it('protege contra valores fora da faixa', () => {
    expect(resolvePage({ page: 0, pageSize: 5000 })).toMatchObject({ page: 1, pageSize: MAX_PAGE_SIZE, skip: 0 });
    expect(resolvePage({ page: -4, pageSize: 0 })).toMatchObject({ page: 1, pageSize: 1 });
  });
});

describe('toPage', () => {
  it('monta o envelope com o total de páginas arredondado para cima', () => {
    expect(toPage(['a', 'b'], 52, 1, 25)).toEqual({ items: ['a', 'b'], total: 52, page: 1, pageSize: 25, totalPages: 3 });
  });

  it('lista vazia ainda tem 1 página', () => {
    expect(toPage([], 0, 1, 25).totalPages).toBe(1);
  });
});

describe('PaginationQueryDto', () => {
  const errorsOf = async (plain: object) =>
    (await validate(plainToInstance(PaginationQueryDto, plain))).map((e) => e.property);

  it('converte números vindos da query string e remove espaços da busca', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '2', pageSize: '50', search: '  maria ' });
    expect(dto).toMatchObject({ page: 2, pageSize: 50, search: 'maria' });
    expect(await errorsOf({ page: '2', pageSize: '50' })).toEqual([]);
  });

  it('rejeita página inválida, tamanho acima do máximo e ordem desconhecida', async () => {
    expect(await errorsOf({ page: '0' })).toContain('page');
    expect(await errorsOf({ page: 'abc' })).toContain('page');
    expect(await errorsOf({ pageSize: String(MAX_PAGE_SIZE + 1) })).toContain('pageSize');
    expect(await errorsOf({ order: 'sideways' })).toContain('order');
  });
});
