import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientsService } from './clients.service';
import { ListClientsQueryDto } from './dto/list-clients.dto';

function makeService(items: any[] = [], total = items.length) {
  const prisma: any = {
    client: { count: jest.fn().mockResolvedValue(total), findMany: jest.fn().mockResolvedValue(items) },
  };
  return { service: new ClientsService(prisma, {} as any, {} as any), prisma };
}

describe('ClientsService.list', () => {
  it('lista só quem já é cliente, ordenado por nome A–Z, 25 por página', async () => {
    const { service, prisma } = makeService();
    await service.list({});
    const args = prisma.client.findMany.mock.calls[0][0];
    expect(args.where.AND[0]).toEqual({ funnelStage: 'CLIENT' });
    expect(args).toMatchObject({ skip: 0, take: 25, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  });

  it('pagina e devolve o envelope com total', async () => {
    const { service, prisma } = makeService([{ id: 'a' }, { id: 'b' }], 61);
    const page = await service.list({ page: 2, pageSize: 30 });
    expect(prisma.client.findMany.mock.calls[0][0]).toMatchObject({ skip: 30, take: 30 });
    expect(page).toEqual({ items: [{ id: 'a' }, { id: 'b' }], total: 61, page: 2, pageSize: 30, totalPages: 3 });
  });

  it('conta com o mesmo filtro da listagem', async () => {
    const { service, prisma } = makeService();
    await service.list({ search: 'maria', successStage: 'ONGOING' as any });
    expect(prisma.client.count.mock.calls[0][0].where).toEqual(prisma.client.findMany.mock.calls[0][0].where);
  });

  it('filtra por etapa do sucesso do cliente e busca por nome/telefone/e-mail', async () => {
    const { service, prisma } = makeService();
    await service.list({ search: '(54) 99999', successStage: 'RENEWAL' as any });
    const and = prisma.client.findMany.mock.calls[0][0].where.AND;
    expect(and[1]).toEqual({ successStage: 'RENEWAL' });
    expect(and[2].OR).toContainEqual({ phoneE164: { contains: '5499999' } });
  });

  it('ordena por data de cadastro (mais novos primeiro) quando pedido', async () => {
    const { service, prisma } = makeService();
    await service.list({ sort: 'createdAt' });
    expect(prisma.client.findMany.mock.calls[0][0].orderBy[0]).toEqual({ createdAt: 'desc' });
    await service.list({ sort: 'createdAt', order: 'asc' });
    expect(prisma.client.findMany.mock.calls[1][0].orderBy[0]).toEqual({ createdAt: 'asc' });
  });
});

describe('ListClientsQueryDto', () => {
  const errorsOf = async (plain: object) => (await validate(plainToInstance(ListClientsQueryDto, plain))).map((e) => e.property);

  it('valida etapa de sucesso e ordenação', async () => {
    expect(await errorsOf({ successStage: 'ONGOING', sort: 'createdAt' })).toEqual([]);
    expect(await errorsOf({ successStage: 'NOPE' })).toContain('successStage');
    expect(await errorsOf({ sort: 'phone' })).toContain('sort');
  });
});
