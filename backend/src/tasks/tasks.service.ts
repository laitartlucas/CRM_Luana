import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, TaskStatus } from '@prisma/client';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './dto/task.dto';

const TASK_INCLUDE = {
  client: { select: { id: true, name: true, funnelStage: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

const DEFAULT_LIMIT = 200;

/** Início e fim do dia corrente no fuso do usuário (o "hoje" dele, não o do servidor). */
export function dayBounds(now: Date, timezone: string) {
  const local = toZonedTime(now, timezone);
  const start = new Date(local);
  start.setHours(0, 0, 0, 0);
  const end = new Date(local);
  end.setHours(23, 59, 59, 999);
  return { startOfDay: fromZonedTime(start, timezone), endOfDay: fromZonedTime(end, timezone) };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private isPrivileged(user: AuthenticatedUser) {
    return user.role !== Role.ATTENDANT;
  }

  /** Atendentes só enxergam tarefas atribuídas a elas ou criadas por elas. */
  private visibility(user: AuthenticatedUser): Prisma.TaskWhereInput {
    return this.isPrivileged(user) ? {} : { OR: [{ assigneeId: user.id }, { createdById: user.id }] };
  }

  private scopeWhere(scope: ListTasksQueryDto['scope'], user: AuthenticatedUser, now = new Date()): Prisma.TaskWhereInput {
    const { endOfDay } = dayBounds(now, user.timezone);
    switch (scope) {
      case 'done':
        return { status: TaskStatus.DONE };
      case 'overdue':
        return { status: TaskStatus.OPEN, dueAt: { lt: now } };
      case 'today':
        return { status: TaskStatus.OPEN, dueAt: { gte: now, lte: endOfDay } };
      case 'upcoming':
        return { status: TaskStatus.OPEN, dueAt: { gt: endOfDay } };
      case 'nodate':
        return { status: TaskStatus.OPEN, dueAt: null };
      default:
        return { status: TaskStatus.OPEN };
    }
  }

  async list(query: ListTasksQueryDto, user: AuthenticatedUser) {
    const filters: Prisma.TaskWhereInput[] = [this.visibility(user), this.scopeWhere(query.scope, user)];

    if (query.assigneeId) {
      filters.push({ assigneeId: query.assigneeId === 'me' ? user.id : query.assigneeId });
    }
    if (query.clientId) filters.push({ clientId: query.clientId });
    if (query.search?.trim()) {
      const term = query.search.trim();
      filters.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { client: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    return this.prisma.task.findMany({
      where: { AND: filters },
      include: TASK_INCLUDE,
      orderBy:
        query.scope === 'done'
          ? [{ completedAt: 'desc' }]
          : [{ dueAt: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? DEFAULT_LIMIT,
    });
  }

  /** Contadores das tarefas abertas atribuídas ao próprio usuário (selo do menu e resumo do dia). */
  async summary(user: AuthenticatedUser) {
    const mine: Prisma.TaskWhereInput = { assigneeId: user.id };
    const count = (scope: ListTasksQueryDto['scope']) =>
      this.prisma.task.count({ where: { AND: [mine, this.scopeWhere(scope, user)] } });
    const [overdue, today, upcoming, nodate] = await Promise.all([
      count('overdue'),
      count('today'),
      count('upcoming'),
      count('nodate'),
    ]);
    return { overdue, today, upcoming, nodate, attention: overdue + today };
  }

  private async getAccessible(id: string, user: AuthenticatedUser) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    if (!this.isPrivileged(user) && task.assigneeId !== user.id && task.createdById !== user.id) {
      throw new ForbiddenException('Você não tem acesso a esta tarefa.');
    }
    return task;
  }

  private async assertAssignee(assigneeId: string) {
    const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId }, select: { active: true } });
    if (!assignee?.active) throw new BadRequestException('Responsável inválido ou inativo.');
  }

  private async assertClient(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) throw new BadRequestException('Lead/cliente não encontrado.');
  }

  async create(dto: CreateTaskDto, user: AuthenticatedUser) {
    const assigneeId = dto.assigneeId ?? user.id;
    if (assigneeId !== user.id) await this.assertAssignee(assigneeId);
    if (dto.clientId) await this.assertClient(dto.clientId);

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description?.trim() || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        priority: dto.priority,
        assigneeId,
        createdById: user.id,
        clientId: dto.clientId ?? null,
      },
      include: TASK_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTaskDto, user: AuthenticatedUser) {
    const task = await this.getAccessible(id, user);
    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) await this.assertAssignee(dto.assigneeId);
    if (dto.clientId) await this.assertClient(dto.clientId);

    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.dueAt !== undefined) data.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.clientId !== undefined) data.clientId = dto.clientId;

    return this.prisma.task.update({ where: { id }, data, include: TASK_INCLUDE });
  }

  async complete(id: string, user: AuthenticatedUser) {
    const task = await this.getAccessible(id, user);
    if (task.status === TaskStatus.DONE) return task;
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.DONE, completedAt: new Date() },
      include: TASK_INCLUDE,
    });
  }

  async reopen(id: string, user: AuthenticatedUser) {
    const task = await this.getAccessible(id, user);
    if (task.status === TaskStatus.OPEN) return task;
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.OPEN, completedAt: null },
      include: TASK_INCLUDE,
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.getAccessible(id, user);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }
}
