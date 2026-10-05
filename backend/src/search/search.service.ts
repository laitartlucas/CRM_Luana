import { Injectable } from '@nestjs/common';
import { FunnelStage } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { personSearchFilter } from '../common/utils/person-search';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  /** Rota interna do app. */
  href: string;
}

export interface SearchResults {
  leads: SearchHit[];
  clients: SearchHit[];
  appointments: SearchHit[];
  tasks: SearchHit[];
}

export const MIN_QUERY_LENGTH = 2;
const PER_GROUP = 5;

const EMPTY: SearchResults = { leads: [], clients: [], appointments: [], tasks: [] };

export function personHref(person: { id: string; funnelStage: FunnelStage }) {
  return person.funnelStage === FunnelStage.CLIENT ? `/clientes/${person.id}` : `/leads/${person.id}`;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async search(query: string, user: AuthenticatedUser): Promise<SearchResults> {
    const term = query.trim();
    if (term.length < MIN_QUERY_LENGTH) return { ...EMPTY };


    const [people, appointments, tasks] = await Promise.all([
      this.prisma.client.findMany({
        where: personSearchFilter(term),
        select: { id: true, name: true, phoneE164: true, instagram: true, funnelStage: true },
        orderBy: { updatedAt: 'desc' },
        take: PER_GROUP * 3,
      }),
      this.prisma.appointment.findMany({
        where: {
          OR: [
            { client: { name: { contains: term, mode: 'insensitive' } } },
            { service: { name: { contains: term, mode: 'insensitive' } } },
          ],
        },
        include: { client: { select: { id: true, name: true, funnelStage: true } }, service: { select: { name: true } } },
        orderBy: { startAt: 'desc' },
        take: PER_GROUP,
      }),
      this.tasks.list({ search: term, limit: PER_GROUP }, user),
    ]);

    const toPersonHit = (p: (typeof people)[number]): SearchHit => ({
      id: p.id,
      title: p.name || '(sem nome)',
      subtitle: [p.phoneE164, p.instagram].filter(Boolean).join(' · ') || null,
      href: personHref(p),
    });

    return {
      leads: people.filter((p) => p.funnelStage !== FunnelStage.CLIENT).slice(0, PER_GROUP).map(toPersonHit),
      clients: people.filter((p) => p.funnelStage === FunnelStage.CLIENT).slice(0, PER_GROUP).map(toPersonHit),
      appointments: appointments.map((a) => ({
        id: a.id,
        title: `${a.client.name || 'Cliente'} — ${a.service.name}`,
        subtitle: formatInTimeZone(a.startAt, user.timezone, 'dd/MM/yyyy HH:mm'),
        href: personHref(a.client),
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: t.client?.name ?? null,
        href: t.client ? personHref(t.client) : '/tarefas',
      })),
    };
  }
}
