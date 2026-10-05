import { MIN_QUERY_LENGTH, SearchService } from './search.service';

const user = { id: 'u1', email: 'a@b.c', role: 'ADMIN', timezone: 'America/Sao_Paulo' } as const;

function makeService() {
  const prisma: any = {
    client: { findMany: jest.fn().mockResolvedValue([]) },
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const tasks: any = { list: jest.fn().mockResolvedValue([]) };
  return { service: new SearchService(prisma, tasks), prisma, tasks };
}

describe('SearchService', () => {
  it(`consultas com menos de ${MIN_QUERY_LENGTH} caracteres não vão ao banco`, async () => {
    const { service, prisma, tasks } = makeService();
    await expect(service.search(' a ', user)).resolves.toEqual({ leads: [], clients: [], appointments: [], tasks: [] });
    expect(prisma.client.findMany).not.toHaveBeenCalled();
    expect(tasks.list).not.toHaveBeenCalled();
  });

  it('busca pessoas por nome, Instagram e e-mail, sem sensibilidade a maiúsculas', async () => {
    const { service, prisma } = makeService();
    await service.search('maria', user);
    const or = prisma.client.findMany.mock.calls[0][0].where.OR;
    expect(or).toEqual([
      { name: { contains: 'maria', mode: 'insensitive' } },
      { instagram: { contains: 'maria', mode: 'insensitive' } },
      { email: { contains: 'maria', mode: 'insensitive' } },
    ]);
  });

  it('com 3+ dígitos também busca no telefone, ignorando formatação', async () => {
    const { service, prisma } = makeService();
    await service.search('(54) 99999', user);
    const or = prisma.client.findMany.mock.calls[0][0].where.OR;
    expect(or).toContainEqual({ phoneE164: { contains: '5499999' } });
  });

  it('separa leads de clientes e monta os links certos', async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany.mockResolvedValue([
      { id: 'l1', name: 'Ana', phoneE164: '+5554999990000', instagram: '@ana', funnelStage: 'LEAD' },
      { id: 'p1', name: 'Bia', phoneE164: null, instagram: null, funnelStage: 'PIPELINE' },
      { id: 'c1', name: null, phoneE164: '+5511900000000', instagram: null, funnelStage: 'CLIENT' },
    ]);
    const res = await service.search('a1', user);
    expect(res.leads).toEqual([
      { id: 'l1', title: 'Ana', subtitle: '+5554999990000 · @ana', href: '/leads/l1' },
      { id: 'p1', title: 'Bia', subtitle: null, href: '/leads/p1' },
    ]);
    expect(res.clients).toEqual([{ id: 'c1', title: '(sem nome)', subtitle: '+5511900000000', href: '/clientes/c1' }]);
  });

  it('limita cada grupo a 5 resultados', async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany.mockResolvedValue(
      Array.from({ length: 9 }, (_, i) => ({ id: `l${i}`, name: `Lead ${i}`, phoneE164: null, instagram: null, funnelStage: 'LEAD' })),
    );
    expect((await service.search('lead', user)).leads).toHaveLength(5);
  });

  it('agendamentos aparecem com a data no fuso do usuário e levam para a ficha da pessoa', async () => {
    const { service, prisma } = makeService();
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'a1',
        startAt: new Date('2026-10-10T17:30:00Z'),
        client: { id: 'c1', name: 'Maria', funnelStage: 'CLIENT' },
        service: { name: 'Consultoria de Estilo' },
      },
    ]);
    const res = await service.search('maria', user);
    expect(res.appointments).toEqual([
      { id: 'a1', title: 'Maria — Consultoria de Estilo', subtitle: '10/10/2026 14:30', href: '/clientes/c1' },
    ]);
  });

  it('tarefas respeitam o usuário (delegadas ao TasksService) e levam à ficha ou à lista', async () => {
    const { service, tasks } = makeService();
    tasks.list.mockResolvedValue([
      { id: 't1', title: 'Ligar', client: { id: 'l1', name: 'Ana', funnelStage: 'LEAD' } },
      { id: 't2', title: 'Revisar catálogo', client: null },
    ]);
    const res = await service.search('revisar', user);
    expect(tasks.list).toHaveBeenCalledWith({ search: 'revisar', limit: 5 }, user);
    expect(res.tasks).toEqual([
      { id: 't1', title: 'Ligar', subtitle: 'Ana', href: '/leads/l1' },
      { id: 't2', title: 'Revisar catálogo', subtitle: null, href: '/tarefas' },
    ]);
  });
});
