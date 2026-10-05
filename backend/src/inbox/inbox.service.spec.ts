import { NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { clientPath, InboxService } from './inbox.service';

function makeService() {
  const prisma: any = {
    userNotification: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(3),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 4 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 7 }),
    },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]) },
  };
  return { service: new InboxService(prisma), prisma };
}

const notification = { type: NotificationType.NEW_LEAD, title: 'Nova lead', dedupeKey: 'lead:1' };

describe('InboxService.notify', () => {
  it('cria um aviso por pessoa ignorando duplicados e devolve quantos foram criados', async () => {
    const { service, prisma } = makeService();
    await expect(service.notifyUsers(['u1', 'u2'], { ...notification, link: '/leads/1' })).resolves.toBe(2);
    const arg = prisma.userNotification.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toEqual([
      { userId: 'u1', type: 'NEW_LEAD', title: 'Nova lead', body: null, link: '/leads/1', dedupeKey: 'lead:1' },
      { userId: 'u2', type: 'NEW_LEAD', title: 'Nova lead', body: null, link: '/leads/1', dedupeKey: 'lead:1' },
    ]);
  });

  it('sem destinatários não toca no banco', async () => {
    const { service, prisma } = makeService();
    await expect(service.notifyUsers([], notification)).resolves.toBe(0);
    expect(prisma.userNotification.createMany).not.toHaveBeenCalled();
  });

  it('notifyAllActive avisa só usuários ativos', async () => {
    const { service, prisma } = makeService();
    await service.notifyAllActive(notification);
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ active: true });
    expect(prisma.userNotification.createMany.mock.calls[0][0].data.map((d: any) => d.userId)).toEqual(['u1', 'u2']);
  });
});

describe('InboxService leitura', () => {
  it('lista só os avisos da própria pessoa, do mais novo ao mais antigo, com limite máximo', async () => {
    const { service, prisma } = makeService();
    await service.list('u1', { unreadOnly: true, limit: 9999 });
    const arg = prisma.userNotification.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u1', readAt: null });
    expect(arg.orderBy).toEqual({ createdAt: 'desc' });
    expect(arg.take).toBe(100);
    await service.list('u1');
    expect(prisma.userNotification.findMany.mock.calls[1][0].where).toEqual({ userId: 'u1' });
  });

  it('conta apenas os não lidos da pessoa', async () => {
    const { service, prisma } = makeService();
    await expect(service.unreadCount('u1')).resolves.toEqual({ count: 3 });
    expect(prisma.userNotification.count).toHaveBeenCalledWith({ where: { userId: 'u1', readAt: null } });
  });

  it('marcar como lida: 404 se não for dela, grava readAt uma vez só', async () => {
    const { service, prisma } = makeService();
    prisma.userNotification.findFirst.mockResolvedValueOnce(null);
    await expect(service.markRead('u1', 'n1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userNotification.findFirst).toHaveBeenCalledWith({ where: { id: 'n1', userId: 'u1' } });

    prisma.userNotification.findFirst.mockResolvedValueOnce({ id: 'n1', readAt: null });
    await service.markRead('u1', 'n1');
    expect(prisma.userNotification.update).toHaveBeenCalledTimes(1);

    prisma.userNotification.findFirst.mockResolvedValueOnce({ id: 'n1', readAt: new Date() });
    await service.markRead('u1', 'n1');
    expect(prisma.userNotification.update).toHaveBeenCalledTimes(1);
  });

  it('marcar todas como lidas só mexe nas não lidas da pessoa', async () => {
    const { service, prisma } = makeService();
    await expect(service.markAllRead('u1')).resolves.toEqual({ updated: 4 });
    expect(prisma.userNotification.updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', readAt: null });
  });

  it('limpeza remove avisos com mais de 60 dias', async () => {
    const { service, prisma } = makeService();
    const now = new Date('2026-10-05T12:00:00Z');
    await expect(service.purgeOld(now)).resolves.toBe(7);
    expect(prisma.userNotification.deleteMany.mock.calls[0][0].where.createdAt.lt).toEqual(new Date('2026-08-06T12:00:00Z'));
  });
});

describe('clientPath', () => {
  it('clientes vão para /clientes e o resto para /leads', () => {
    expect(clientPath({ id: 'a', funnelStage: 'CLIENT' })).toBe('/clientes/a');
    expect(clientPath({ id: 'b', funnelStage: 'LEAD' })).toBe('/leads/b');
    expect(clientPath({ id: 'c', funnelStage: 'PIPELINE' })).toBe('/leads/c');
  });
});
