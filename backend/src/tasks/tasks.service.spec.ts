import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, TaskStatus } from '@prisma/client';
import { dayBounds, TasksService } from './tasks.service';

const admin = { id: 'admin', email: 'a@x.y', role: Role.ADMIN, timezone: 'America/Sao_Paulo' } as const;
const attendant = { id: 'att', email: 'b@x.y', role: Role.ATTENDANT, timezone: 'America/Sao_Paulo' } as const;

function makeService(task?: any) {
  const prisma: any = {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(task ?? null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 't1', ...data })),
      update: jest.fn().mockImplementation(async ({ data }) => ({ id: 't1', ...task, ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ active: true }) },
    client: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
  };
  return { service: new TasksService(prisma), prisma };
}

const openTask = { id: 't1', status: TaskStatus.OPEN, assigneeId: 'other', createdById: 'other2' };

describe('dayBounds', () => {
  it('usa o dia do fuso do usuário, não o do servidor (02:00 UTC ainda é o dia anterior em São Paulo)', () => {
    const now = new Date('2026-10-06T02:00:00Z'); // 05/10 23:00 em São Paulo (UTC-3)
    const { startOfDay, endOfDay } = dayBounds(now, 'America/Sao_Paulo');
    expect(startOfDay.toISOString()).toBe('2026-10-05T03:00:00.000Z');
    expect(endOfDay.toISOString()).toBe('2026-10-06T02:59:59.999Z');
  });
});

describe('TasksService.list — escopos', () => {
  const now = new Date();

  async function whereFor(scope: any, user: any = admin) {
    const { service, prisma } = makeService();
    await service.list({ scope }, user);
    return prisma.task.findMany.mock.calls[0][0].where.AND[1];
  }

  it('atrasadas: abertas com prazo anterior a agora', async () => {
    const w = await whereFor('overdue');
    expect(w.status).toBe('OPEN');
    expect(w.dueAt.lt.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000);
  });

  it('hoje: do agora até o fim do dia; próximas: depois do fim do dia (sem sobreposição)', async () => {
    const today = await whereFor('today');
    const upcoming = await whereFor('upcoming');
    expect(today.dueAt.lte.getTime()).toBe(upcoming.dueAt.gt.getTime());
  });

  it('sem prazo e concluídas', async () => {
    expect((await whereFor('nodate')).dueAt).toBeNull();
    expect((await whereFor('done')).status).toBe('DONE');
  });

  it('sem escopo lista as abertas', async () => {
    expect((await whereFor(undefined)).status).toBe('OPEN');
  });
});

describe('TasksService.list — filtros e permissões', () => {
  it('atendente só enxerga tarefas dela (atribuídas ou criadas); admin vê tudo', async () => {
    const a = makeService();
    await a.service.list({}, attendant);
    expect(a.prisma.task.findMany.mock.calls[0][0].where.AND[0]).toEqual({
      OR: [{ assigneeId: 'att' }, { createdById: 'att' }],
    });
    const b = makeService();
    await b.service.list({}, admin);
    expect(b.prisma.task.findMany.mock.calls[0][0].where.AND[0]).toEqual({});
  });

  it('assigneeId=me vira o id do usuário; busca procura em título, descrição e nome do cliente', async () => {
    const { service, prisma } = makeService();
    await service.list({ assigneeId: 'me', search: ' prova ', clientId: 'c9' }, admin);
    const and = prisma.task.findMany.mock.calls[0][0].where.AND;
    expect(and).toContainEqual({ assigneeId: 'admin' });
    expect(and).toContainEqual({ clientId: 'c9' });
    const search = and.find((f: any) => f.OR && f.OR[0].title);
    expect(search.OR).toHaveLength(3);
    expect(search.OR[0].title.contains).toBe('prova');
  });

  it('limita o resultado', async () => {
    const { service, prisma } = makeService();
    await service.list({}, admin);
    expect(prisma.task.findMany.mock.calls[0][0].take).toBe(200);
    await service.list({ limit: 20 }, admin);
    expect(prisma.task.findMany.mock.calls[1][0].take).toBe(20);
  });
});

describe('TasksService.summary', () => {
  it('conta só as tarefas do próprio usuário e soma atenção = atrasadas + hoje', async () => {
    const { service, prisma } = makeService();
    prisma.task.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    await expect(service.summary(admin)).resolves.toEqual({ overdue: 2, today: 3, upcoming: 5, nodate: 1, attention: 5 });
    for (const call of prisma.task.count.mock.calls) {
      expect(call[0].where.AND[0]).toEqual({ assigneeId: 'admin' });
    }
  });
});

describe('TasksService.create', () => {
  it('atribui a quem criou por padrão, sem validar o próprio usuário', async () => {
    const { service, prisma } = makeService();
    await service.create({ title: 'Ligar para Maria' }, admin);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.task.create.mock.calls[0][0].data).toMatchObject({
      title: 'Ligar para Maria',
      assigneeId: 'admin',
      createdById: 'admin',
      dueAt: null,
      clientId: null,
    });
  });

  it('converte o prazo em Date e vincula ao cliente', async () => {
    const { service, prisma } = makeService();
    await service.create({ title: 'x', dueAt: '2026-10-10T15:00:00.000Z', clientId: 'c1', priority: 'HIGH' }, admin);
    const data = prisma.task.create.mock.calls[0][0].data;
    expect(data.dueAt).toEqual(new Date('2026-10-10T15:00:00.000Z'));
    expect(data.clientId).toBe('c1');
    expect(data.priority).toBe('HIGH');
  });

  it('rejeita responsável inativo/inexistente e cliente inexistente', async () => {
    const a = makeService();
    a.prisma.user.findUnique.mockResolvedValue({ active: false });
    await expect(a.service.create({ title: 'x', assigneeId: 'u2' }, admin)).rejects.toBeInstanceOf(BadRequestException);
    const b = makeService();
    b.prisma.client.findUnique.mockResolvedValue(null);
    await expect(b.service.create({ title: 'x', clientId: 'nope' }, admin)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TasksService — acesso por tarefa', () => {
  it('404 quando a tarefa não existe', async () => {
    await expect(makeService().service.complete('t1', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('atendente não mexe em tarefa de outra pessoa; admin sim; dono (atribuída ou criada) sim', async () => {
    await expect(makeService(openTask).service.complete('t1', attendant)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(makeService(openTask).service.remove('t1', attendant)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(makeService(openTask).service.complete('t1', admin)).resolves.toBeDefined();
    await expect(makeService({ ...openTask, assigneeId: 'att' }).service.complete('t1', attendant)).resolves.toBeDefined();
    await expect(makeService({ ...openTask, createdById: 'att' }).service.update('t1', { title: 'n' }, attendant)).resolves.toBeDefined();
  });

  it('concluir grava completedAt; reabrir limpa; ambos são idempotentes', async () => {
    const open = makeService(openTask);
    await open.service.complete('t1', admin);
    const data = open.prisma.task.update.mock.calls[0][0].data;
    expect(data.status).toBe('DONE');
    expect(data.completedAt).toBeInstanceOf(Date);

    const done = makeService({ ...openTask, status: TaskStatus.DONE });
    await done.service.complete('t1', admin);
    expect(done.prisma.task.update).not.toHaveBeenCalled();
    await done.service.reopen('t1', admin);
    expect(done.prisma.task.update.mock.calls[0][0].data).toEqual({ status: 'OPEN', completedAt: null });

    await open.service.reopen('t1', admin);
    expect(open.prisma.task.update).toHaveBeenCalledTimes(1);
  });

  it('update só envia os campos informados e permite limpar prazo, descrição e vínculo com null', async () => {
    const { service, prisma } = makeService(openTask);
    await service.update('t1', { title: 'Novo' }, admin);
    expect(prisma.task.update.mock.calls[0][0].data).toEqual({ title: 'Novo' });

    await service.update('t1', { dueAt: null, description: null, clientId: null }, admin);
    expect(prisma.task.update.mock.calls[1][0].data).toEqual({ dueAt: null, description: null, clientId: null });
  });

  it('excluir remove a tarefa', async () => {
    const { service, prisma } = makeService(openTask);
    await expect(service.remove('t1', admin)).resolves.toEqual({ ok: true });
    expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });
});
