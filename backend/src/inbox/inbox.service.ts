import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NewNotification {
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Rota interna do app, ex.: /tarefas ou /leads/<id>. */
  link?: string | null;
  /** Identifica o fato notificado; repetir a mesma chave para a mesma pessoa não cria outro aviso. */
  dedupeKey: string;
}

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const RETENTION_DAYS = 60;

/** Página interna de uma lead/cliente (clientes ficam em /clientes, o resto em /leads). */
export function clientPath(client: { id: string; funnelStage: string }) {
  return client.funnelStage === 'CLIENT' ? `/clientes/${client.id}` : `/leads/${client.id}`;
}

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria o aviso para cada pessoa que ainda não o recebeu; devolve quantos foram realmente criados. */
  async notifyUsers(userIds: string[], notification: NewNotification): Promise<number> {
    if (userIds.length === 0) return 0;
    const result = await this.prisma.userNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: notification.type,
        title: notification.title,
        body: notification.body ?? null,
        link: notification.link ?? null,
        dedupeKey: notification.dedupeKey,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async notifyAllActive(notification: NewNotification): Promise<number> {
    const users = await this.prisma.user.findMany({ where: { active: true }, select: { id: true } });
    return this.notifyUsers(
      users.map((u) => u.id),
      notification,
    );
  }

  list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.prisma.userNotification.findMany({
      where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.userNotification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.userNotification.findFirst({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notificação não encontrada.');
    if (!notification.readAt) {
      await this.prisma.userNotification.update({ where: { id }, data: { readAt: new Date() } });
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Apaga avisos antigos para a tabela não crescer sem limite. */
  async purgeOld(now = new Date()) {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.userNotification.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
  }
}
