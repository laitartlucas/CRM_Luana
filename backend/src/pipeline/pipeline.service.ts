import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, FunnelStage, PipelineStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeStageDto } from './dto/change-stage.dto';
import { UpdatePipelineCardDto } from './dto/update-pipeline-card.dto';
import { PIPELINE_EVENTS } from './pipeline.events';

// Nem toda transição de etapa é "avanço" — algumas são saídas laterais do
// funil principal (perdida, não agendada, no-show, futuro). Mapeamos aqui
// quais etapas terminam o Pipeline e para qual FunnelStage macro a pessoa vai.
const TERMINAL_TO_FUNNEL: Partial<Record<PipelineStage, FunnelStage>> = {
  CLOSED_WON: FunnelStage.CLIENT,
  CLOSED_LOST: FunnelStage.LOST,
};

// Ordem "principal" do funil, usada no relatório de funil/conversão. As
// demais etapas (NOT_SCHEDULED, NO_SHOW, CLOSED_LOST, FUTURE) são saídas
// laterais e aparecem à parte, não como um degrau sequencial.
const MAIN_FUNNEL_ORDER: PipelineStage[] = [
  PipelineStage.NEW,
  PipelineStage.FIRST_CONTACT,
  PipelineStage.CALL_SCHEDULED,
  PipelineStage.PRE_CALL,
  PipelineStage.POST_CALL,
  PipelineStage.PROPOSAL_SENT,
  PipelineStage.FOLLOW_UP,
  PipelineStage.CLOSED_WON,
];
const SIDE_STAGES: PipelineStage[] = [
  PipelineStage.NOT_SCHEDULED,
  PipelineStage.NO_SHOW,
  PipelineStage.CLOSED_LOST,
  PipelineStage.FUTURE,
];

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Cards agrupados por etapa — só quem ainda está ativo no Pipeline (Módulo 2). */
  async board() {
    const clients = await this.prisma.client.findMany({
      where: { funnelStage: FunnelStage.PIPELINE },
      orderBy: { pipelineStageEnteredAt: 'asc' },
    });
    const columns = Object.fromEntries(Object.values(PipelineStage).map((stage) => [stage, [] as Client[]]));
    for (const client of clients) {
      if (client.pipelineStage) columns[client.pipelineStage].push(client);
    }
    return columns;
  }

  private async findCard(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Registro não encontrado.');
    if (client.funnelStage !== FunnelStage.PIPELINE || !client.pipelineStage) {
      throw new BadRequestException('Esse registro não está ativo no Pipeline Comercial.');
    }
    return client;
  }

  /**
   * Único ponto de escrita de transição de etapa (mesmo princípio de
   * "porta única" do AppointmentsService). Fecha o FunnelStageEvent aberto,
   * abre um novo, e — se a etapa for terminal (Fechou/Não fechou) — já
   * flipa o FunnelStage macro e inicializa o Módulo 3 na mesma transação,
   * para nunca deixar o registro num estado parcialmente migrado.
   */
  async changeStage(id: string, dto: ChangeStageDto, userId?: string) {
    const card = await this.findCard(id);

    if (dto.toStage === PipelineStage.CALL_SCHEDULED && !dto.callDate) {
      throw new BadRequestException('Informe a data/hora da call para mover para "Call agendada".');
    }

    const now = new Date();
    const fromStage = card.pipelineStage;
    const callDate = dto.callDate ? new Date(dto.callDate) : undefined;
    const nextFunnelStage = TERMINAL_TO_FUNNEL[dto.toStage] ?? FunnelStage.PIPELINE;

    const operations = [
      this.prisma.funnelStageEvent.updateMany({
        where: { clientId: id, module: 'PIPELINE', exitedAt: null },
        data: { exitedAt: now },
      }),
      this.prisma.funnelStageEvent.create({
        data: {
          clientId: id,
          module: 'PIPELINE',
          fromStage,
          toStage: dto.toStage,
          changedByUserId: userId,
          reason: dto.reason,
          enteredAt: now,
        },
      }),
      this.prisma.client.update({
        where: { id },
        data: {
          pipelineStage: dto.toStage,
          pipelineStageEnteredAt: now,
          funnelStage: nextFunnelStage,
          callDate: callDate ?? card.callDate,
        },
      }),
    ];

    if (dto.toStage === PipelineStage.CLOSED_WON) {
      operations.push(
        this.prisma.funnelStageEvent.create({
          data: {
            clientId: id,
            module: 'SUCCESS',
            fromStage: null,
            toStage: 'NEW_CLIENT',
            changedByUserId: userId,
            enteredAt: now,
          },
        }),
        this.prisma.client.update({
          where: { id },
          data: { successStage: 'NEW_CLIENT', successStageEnteredAt: now },
        }),
      );
    }

    const results = await this.prisma.$transaction(operations);
    const updated = results[results.length - 1] as Client;

    this.events.emit(PIPELINE_EVENTS.STAGE_CHANGED, {
      client: updated,
      fromStage,
      toStage: dto.toStage,
      changedByUserId: userId,
      reason: dto.reason,
      callDate,
    });

    return updated;
  }

  async updateCard(id: string, dto: UpdatePipelineCardDto) {
    await this.findCard(id);
    return this.prisma.client.update({
      where: { id },
      data: {
        nextActionNote: dto.nextActionNote,
        nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : undefined,
        proposalValue: dto.proposalValue,
        paymentMethod: dto.paymentMethod,
      },
    });
  }

  // -----------------------------------------------------------------
  // Relatórios — agregação em JS sobre findMany, mesmo estilo de
  // dashboard.service.ts (sem $queryRaw; volume do negócio não justifica).
  // -----------------------------------------------------------------

  async funnelReport(from?: Date, to?: Date) {
    const events = await this.prisma.funnelStageEvent.findMany({
      where: {
        module: 'PIPELINE',
        enteredAt: from || to ? { gte: from, lte: to } : undefined,
      },
      select: { clientId: true, toStage: true },
    });

    const reached = new Map<string, Set<string>>();
    for (const ev of events) {
      if (!reached.has(ev.toStage)) reached.set(ev.toStage, new Set());
      reached.get(ev.toStage)!.add(ev.clientId);
    }

    const mainPath = MAIN_FUNNEL_ORDER.map((stage) => ({ stage, count: reached.get(stage)?.size ?? 0 }));
    const withConversion = mainPath.map((entry, i) => ({
      ...entry,
      conversionFromPrevious: i === 0 || mainPath[i - 1].count === 0 ? null : entry.count / mainPath[i - 1].count,
    }));
    const sideStages = SIDE_STAGES.map((stage) => ({ stage, count: reached.get(stage)?.size ?? 0 }));

    return { mainPath: withConversion, sideStages };
  }

  async originReport() {
    const clients = await this.prisma.client.findMany({
      where: { leadSource: { not: null } },
      select: { leadSource: true, leadSourceContentRef: true, funnelStage: true, pipelineStage: true },
    });

    const map = new Map<
      string,
      { leadSource: string; contentRef: string | null; leads: number; closedWon: number }
    >();
    for (const c of clients) {
      const key = `${c.leadSource}::${c.leadSourceContentRef ?? ''}`;
      if (!map.has(key)) {
        map.set(key, { leadSource: c.leadSource as string, contentRef: c.leadSourceContentRef, leads: 0, closedWon: 0 });
      }
      const entry = map.get(key)!;
      entry.leads += 1;
      if (c.funnelStage === FunnelStage.CLIENT || c.pipelineStage === PipelineStage.CLOSED_WON) {
        entry.closedWon += 1;
      }
    }

    return Array.from(map.values())
      .map((entry) => ({ ...entry, conversionRate: entry.leads ? entry.closedWon / entry.leads : 0 }))
      .sort((a, b) => b.leads - a.leads);
  }

  async metrics() {
    const events = await this.prisma.funnelStageEvent.findMany({
      where: { module: 'PIPELINE', exitedAt: { not: null } },
      select: { toStage: true, enteredAt: true, exitedAt: true },
    });

    const durationsByStage = new Map<string, number[]>();
    for (const ev of events) {
      const ms = ev.exitedAt!.getTime() - ev.enteredAt.getTime();
      if (!durationsByStage.has(ev.toStage)) durationsByStage.set(ev.toStage, []);
      durationsByStage.get(ev.toStage)!.push(ms);
    }
    const avgTimePerStageHours = Array.from(durationsByStage.entries()).map(([stage, durations]) => ({
      stage,
      avgHours: durations.reduce((a, b) => a + b, 0) / durations.length / (1000 * 60 * 60),
    }));

    const closedWon = await this.prisma.client.findMany({
      where: { pipelineStage: PipelineStage.CLOSED_WON },
      select: { proposalValue: true },
    });
    const values = closedWon.map((c) => Number(c.proposalValue ?? 0)).filter((v) => v > 0);
    const averageTicket = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    // Forma de pagamento é preenchida na ficha da cliente (Módulo 3), não no
    // card do Pipeline — por isso soma sobre quem já é "Cliente" (funnelStage),
    // não sobre quem fechou o Pipeline (nem todo Cliente passou pelo Pipeline).
    const clientsWithPayment = await this.prisma.client.findMany({
      where: { funnelStage: FunnelStage.CLIENT, paymentMethod: { not: null } },
      select: { paymentMethod: true },
    });
    const paymentCounts = new Map<string, number>();
    for (const c of clientsWithPayment) {
      if (!c.paymentMethod) continue;
      paymentCounts.set(c.paymentMethod, (paymentCounts.get(c.paymentMethod) ?? 0) + 1);
    }
    const mostUsedPaymentMethod = Array.from(paymentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return { avgTimePerStageHours, averageTicket, mostUsedPaymentMethod, closedWonCount: closedWon.length };
  }
}
