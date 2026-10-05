import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LeadsService } from './leads.service';
import { ListLeadsQueryDto } from './dto/list-leads.dto';

const t = (iso: string) => new Date(iso);

// Lead "rica": origem forte + dores + desejos => score alto. "Fraca": só a origem mais baixa.
const rich = { leadSource: 'REFERRAL', painPoints: 'x', desires: 'y', objections: null, pipelineStage: null };
const poor = { leadSource: 'OTHER', painPoints: null, desires: null, objections: null, pipelineStage: null };

function makeService(rows: any[] = []) {
  const prisma: any = {
    client: {
      count: jest.fn().mockResolvedValue(rows.length),
      findMany: jest.fn().mockImplementation(async (args: any) => {
        if (args.select) return rows; // caminho do score: só colunas de pontuação
        if (args.where?.id?.in) return rows.filter((r) => args.where.id.in.includes(r.id)); // fichas completas da página
        return rows; // caminho do banco (nome/data)
      }),
    },
    funnelStageEvent: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new LeadsService(prisma), prisma };
}

const lead = (id: string, over: any = {}) => ({ id, name: id, createdAt: t('2026-10-01T10:00:00Z'), ...poor, ...over });

describe('LeadsService.list — filtros', () => {
  it('por padrão lista leads novas e as que estão no Pipeline', async () => {
    const { service, prisma } = makeService();
    await service.list({});
    const and = prisma.client.findMany.mock.calls[0][0].where.AND;
    expect(and[0]).toEqual({ funnelStage: { in: ['LEAD', 'PIPELINE'] } });
  });

  it('aplica etapa, origem e busca', async () => {
    const { service, prisma } = makeService();
    await service.list({ stage: 'PIPELINE', source: 'REEL' as any, search: 'maria' });
    const and = prisma.client.findMany.mock.calls[0][0].where.AND;
    expect(and[0]).toEqual({ funnelStage: 'PIPELINE' });
    expect(and[1]).toEqual({ leadSource: 'REEL' });
    expect(and[2].OR[0]).toEqual({ name: { contains: 'maria', mode: 'insensitive' } });
  });
});

describe('LeadsService.list — ordenar por nome ou data (paginado no banco)', () => {
  it('conta o total e pagina com skip/take, com id como desempate', async () => {
    const { service, prisma } = makeService([lead('a'), lead('b')]);
    prisma.client.count.mockResolvedValue(57);
    const page = await service.list({ sort: 'createdAt', page: 3, pageSize: 20 });
    const args = prisma.client.findMany.mock.calls[0][0];
    expect(args).toMatchObject({ skip: 40, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    expect(page).toMatchObject({ total: 57, page: 3, pageSize: 20, totalPages: 3 });
    expect(page.items).toHaveLength(2);
  });

  it('nome ordena A–Z por padrão e respeita a direção pedida', async () => {
    const a = makeService();
    await a.service.list({ sort: 'name' });
    expect(a.prisma.client.findMany.mock.calls[0][0].orderBy[0]).toEqual({ name: 'asc' });
    const b = makeService();
    await b.service.list({ sort: 'name', order: 'desc' });
    expect(b.prisma.client.findMany.mock.calls[0][0].orderBy[0]).toEqual({ name: 'desc' });
  });

  it('calcula o score só das leads da página', async () => {
    const { service, prisma } = makeService([lead('a', rich)]);
    const page = await service.list({ sort: 'name' });
    expect(page.items[0].leadScore).toBeGreaterThan(0);
    expect(prisma.funnelStageEvent.findMany.mock.calls[0][0].where.clientId).toEqual({ in: ['a'] });
  });
});

describe('LeadsService.list — ordenar por score (padrão)', () => {
  it('maiores scores primeiro; empate resolvido pela mais recente', async () => {
    const { service } = makeService([
      lead('fraca', { createdAt: t('2026-10-03T00:00:00Z') }),
      lead('rica', { ...rich, createdAt: t('2026-10-01T00:00:00Z') }),
      lead('fraca-antiga', { createdAt: t('2026-09-01T00:00:00Z') }),
    ]);
    const page = await service.list({});
    expect(page.items.map((i) => i.id)).toEqual(['rica', 'fraca', 'fraca-antiga']);
    expect(page.items[0].leadScore).toBeGreaterThan(page.items[1].leadScore);
  });

  it('ordem asc inverte (menores scores primeiro)', async () => {
    const { service } = makeService([lead('rica', rich), lead('fraca')]);
    const page = await service.list({ order: 'asc' });
    expect(page.items.map((i) => i.id)).toEqual(['fraca', 'rica']);
  });

  it('pagina em memória: total é o de todas as que batem, a página traz só a fatia pedida', async () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id, i) => lead(id, { createdAt: t(`2026-10-0${i + 1}T00:00:00Z`) }));
    const { service, prisma } = makeService(rows);
    const page2 = await service.list({ page: 2, pageSize: 2 });
    // mesmo score => mais recentes primeiro: e, d | c, b | a
    expect(page2.items.map((i) => i.id)).toEqual(['c', 'b']);
    expect(page2).toMatchObject({ total: 5, page: 2, pageSize: 2, totalPages: 3 });
    // só as fichas completas da página são buscadas
    const fullFetch = prisma.client.findMany.mock.calls.find((c: any) => c[0].where?.id?.in);
    expect(fullFetch[0].where.id.in).toEqual(['c', 'b']);
  });

  it('só carrega colunas de pontuação para ranquear e usa o mesmo filtro nos eventos do funil', async () => {
    const { service, prisma } = makeService([lead('a')]);
    await service.list({ source: 'REEL' as any });
    const scoreCall = prisma.client.findMany.mock.calls[0][0];
    expect(Object.keys(scoreCall.select).sort()).toEqual(
      ['createdAt', 'desires', 'id', 'leadSource', 'objections', 'painPoints', 'pipelineStage'].sort(),
    );
    expect(prisma.funnelStageEvent.findMany.mock.calls[0][0].where.client).toEqual(scoreCall.where);
  });

  it('bônus de velocidade: entrar no Pipeline em até 1h rende mais pontos', async () => {
    const created = t('2026-10-01T10:00:00Z');
    const { service, prisma } = makeService([lead('rapida', { createdAt: created }), lead('lenta', { createdAt: created })]);
    prisma.funnelStageEvent.findMany.mockResolvedValue([
      { clientId: 'rapida', enteredAt: t('2026-10-01T10:30:00Z') },
      { clientId: 'lenta', enteredAt: t('2026-10-05T10:00:00Z') },
    ]);
    const page = await service.list({});
    expect(page.items.map((i) => i.id)).toEqual(['rapida', 'lenta']);
    expect(page.items[0].leadScore - page.items[1].leadScore).toBe(20);
  });
});

describe('ListLeadsQueryDto', () => {
  const errorsOf = async (plain: object) => (await validate(plainToInstance(ListLeadsQueryDto, plain))).map((e) => e.property);

  it('aceita filtros válidos', async () => {
    expect(await errorsOf({ source: 'REEL', stage: 'PIPELINE', sort: 'name', order: 'asc', page: '2' })).toEqual([]);
  });

  it('rejeita origem, etapa e ordenação desconhecidas (antes explodiam como 500 no Prisma)', async () => {
    expect(await errorsOf({ source: 'TIKTOK' })).toContain('source');
    expect(await errorsOf({ stage: 'CLIENT' })).toContain('stage');
    expect(await errorsOf({ sort: 'email' })).toContain('sort');
  });
});
