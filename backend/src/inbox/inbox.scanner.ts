import { Injectable, Logger } from '@nestjs/common';
import { MessageDirection, NotificationType, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { clientPath, InboxService } from './inbox.service';
import { OVERDUE_LOOKBACK_DAYS, TASK_DUE_TITLES, taskDueNotice } from './task-due';

const DAY_MS = 24 * 60 * 60 * 1000;
const HANDOFF_WINDOW_MS = DAY_MS;
const BODY_MAX = 140;

function truncate(text: string, max = BODY_MAX) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Varredura periódica que transforma estados do sistema em avisos: tarefas
 * perto do prazo e conversas esperando resposta humana. É derivada do estado
 * atual (não depende de eventos) — o que a deixa robusta a reinício do
 * servidor e a edição de prazos — e idempotente via dedupeKey.
 */
@Injectable()
export class InboxScanner {
  private readonly logger = new Logger(InboxScanner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inbox: InboxService,
  ) {}

  async run(now = new Date()) {
    const [tasks, handoffs, purged] = await Promise.all([
      this.scanTasks(now),
      this.scanHandoffs(now),
      this.inbox.purgeOld(now),
    ]);
    if (tasks || handoffs || purged) {
      this.logger.log(`Varredura: ${tasks} aviso(s) de tarefa, ${handoffs} de atendimento, ${purged} antigo(s) removido(s).`);
    }
    return { tasks, handoffs, purged };
  }

  async scanTasks(now: Date): Promise<number> {
    const candidates = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.OPEN,
        assigneeId: { not: null },
        // Cobre tarefas só com data, que avisam de manhã (até ~16h antes do 23:59), e tarefas com hora marcada.
        dueAt: { gte: new Date(now.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS), lte: new Date(now.getTime() + DAY_MS) },
      },
      include: { assignee: { select: { id: true, active: true, timezone: true } }, client: { select: { name: true } } },
    });

    let created = 0;
    for (const task of candidates) {
      if (!task.assignee?.active || !task.dueAt) continue;
      const kind = taskDueNotice(task.dueAt, task.assignee.timezone, now);
      if (!kind) continue;
      created += await this.inbox.notifyUsers([task.assignee.id], {
        type: NotificationType.TASK_DUE,
        title: `${TASK_DUE_TITLES[kind]}: ${truncate(task.title, 80)}`,
        body: task.client?.name ? `Sobre ${task.client.name}` : null,
        link: '/tarefas',
        // Uma vez por tarefa e prazo: mudar o prazo gera um aviso novo.
        dedupeKey: `task-due:${task.id}:${task.dueAt.getTime()}`,
      });
    }
    return created;
  }

  /** Conversas que aguardam atendimento humano e cuja última mensagem é do cliente (ainda sem resposta). */
  async scanHandoffs(now: Date): Promise<number> {
    const conversations = await this.prisma.conversation.findMany({
      where: { needsHuman: true, lastMessageAt: { gte: new Date(now.getTime() - HANDOFF_WINDOW_MS) } },
      include: {
        client: { select: { id: true, name: true, funnelStage: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    let created = 0;
    for (const conversation of conversations) {
      const last = conversation.messages[0];
      if (!last || last.direction !== MessageDirection.IN) continue;
      created += await this.inbox.notifyAllActive({
        type: NotificationType.HUMAN_HANDOFF,
        title: `${conversation.client.name || 'Um contato'} está aguardando atendimento`,
        body: last.content ? truncate(last.content) : 'Enviou uma mensagem.',
        link: clientPath(conversation.client),
        dedupeKey: `handoff:${last.id}`,
      });
    }
    return created;
  }
}
