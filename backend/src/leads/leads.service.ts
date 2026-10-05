import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Client, FunnelStage, LeadSource, PipelineStage, Prisma } from '@prisma/client';
import { Paginated, resolvePage, toPage } from '../common/pagination';
import { personSearchFilter } from '../common/utils/person-search';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads.dto';

// Lead scoring (diferencial de IA) — heurística v1, não é um modelo
// treinado: cruza origem, sinais qualitativos do relatório da lead,
// velocidade de resposta e progresso no funil para priorizar follow-ups.
// Precisa de dado histórico real (Fechou vs. Não fechou) antes de virar
// algo mais sofisticado — mesma ressalva que Client.noShowScore.
const SOURCE_WEIGHT: Record<LeadSource, number> = {
  REFERRAL: 25,
  EVENT: 20,
  CHALLENGE: 15,
  REEL: 15,
  COMMENT: 12,
  KEYWORD: 12,
  STORY: 10,
  CAROUSEL: 10,
  WHATSAPP_GROUP: 8,
  OTHER: 5,
};

const STAGE_PROGRESS_WEIGHT: Partial<Record<PipelineStage, number>> = {
  NEW: 0,
  FIRST_CONTACT: 5,
  CALL_SCHEDULED: 15,
  PRE_CALL: 20,
  POST_CALL: 25,
  PROPOSAL_SENT: 30,
  FOLLOW_UP: 20,
};

// Colunas que entram no cálculo do leadScore (evita carregar a ficha inteira só para pontuar).
const SCORE_FIELDS = {
  id: true,
  createdAt: true,
  leadSource: true,
  painPoints: true,
  desires: true,
  objections: true,
  pipelineStage: true,
} satisfies Prisma.ClientSelect;
type ScoreInput = Pick<Client, 'createdAt' | 'leadSource' | 'painPoints' | 'desires' | 'objections' | 'pipelineStage'>;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Módulo 1 + leads já avançadas para o Pipeline (Módulo 2) que ainda não fecharam/perderam.
   *
   * Ordenar por nome/data pagina direto no banco (e só calcula o score da
   * página). O leadScore é calculado em código a partir de várias colunas e
   * eventos, então ordenar por ele precisa pontuar todas as leads que batem
   * com o filtro — aceitável para o volume do negócio, e só nesse caso.
   */
  async list(query: ListLeadsQueryDto): Promise<Paginated<Client & { leadScore: number }>> {
    const { page, pageSize, skip, take } = resolvePage(query);
    const sort = query.sort ?? 'leadScore';
    const direction = query.order ?? (sort === 'name' ? 'asc' : 'desc');

    const where: Prisma.ClientWhereInput = {
      AND: [
        { funnelStage: query.stage ? FunnelStage[query.stage] : { in: [FunnelStage.LEAD, FunnelStage.PIPELINE] } },
        query.source ? { leadSource: query.source } : {},
        personSearchFilter(query.search) ?? {},
      ],
    };

    if (sort === 'leadScore') {
      return this.listByScore(where, direction, { page, pageSize, skip, take });
    }

    const [total, clients] = await Promise.all([
      this.prisma.client.count({ where }),
      // id como desempate: sem ele, linhas iguais podem repetir ou sumir entre páginas.
      this.prisma.client.findMany({ where, orderBy: [{ [sort]: direction }, { id: 'asc' }], skip, take }),
    ]);
    const entered = await this.firstPipelineEntries({ clientId: { in: clients.map((c) => c.id) } });
    const items = clients.map((client) => ({ ...client, leadScore: this.computeLeadScore(client, entered.get(client.id)) }));
    return toPage(items, total, page, pageSize);
  }

  private async listByScore(
    where: Prisma.ClientWhereInput,
    direction: 'asc' | 'desc',
    { page, pageSize, skip, take }: { page: number; pageSize: number; skip: number; take: number },
  ) {
    const [rows, entered] = await Promise.all([
      this.prisma.client.findMany({ where, select: SCORE_FIELDS }),
      this.firstPipelineEntries({ client: where }),
    ]);

    const ranked = rows
      .map((row) => ({ id: row.id, createdAt: row.createdAt, score: this.computeLeadScore(row, entered.get(row.id)) }))
      .sort(
        (a, b) =>
          (direction === 'desc' ? b.score - a.score : a.score - b.score) ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );

    const pageRows = ranked.slice(skip, skip + take);
    const full = await this.prisma.client.findMany({ where: { id: { in: pageRows.map((r) => r.id) } } });
    const byId = new Map(full.map((c) => [c.id, c]));
    const items = pageRows.flatMap((r) => {
      const client = byId.get(r.id);
      return client ? [{ ...client, leadScore: r.score }] : [];
    });
    return toPage(items, ranked.length, page, pageSize);
  }

  /** Quando cada lead entrou no Pipeline (etapa NEW) pela primeira vez — alimenta o bônus de velocidade de resposta. */
  private async firstPipelineEntries(filter: Prisma.FunnelStageEventWhereInput) {
    const events = await this.prisma.funnelStageEvent.findMany({
      where: { ...filter, module: 'PIPELINE', toStage: PipelineStage.NEW },
      select: { clientId: true, enteredAt: true },
    });
    return new Map(events.map((e) => [e.clientId, e.enteredAt]));
  }

  private computeLeadScore(client: ScoreInput, firstPipelineEnteredAt?: Date): number {
    let score = 0;
    if (client.leadSource) score += SOURCE_WEIGHT[client.leadSource] ?? 0;
    if (client.painPoints) score += 15;
    if (client.desires) score += 10;
    if (client.objections) score -= 10;

    if (firstPipelineEnteredAt) {
      const hoursToRespond = (firstPipelineEnteredAt.getTime() - client.createdAt.getTime()) / 3_600_000;
      score += hoursToRespond <= 1 ? 20 : hoursToRespond <= 24 ? 10 : 0;
    }

    if (client.pipelineStage) score += STAGE_PROGRESS_WEIGHT[client.pipelineStage] ?? 0;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async findById(id: string) {
    const lead = await this.prisma.client.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead não encontrada.');
    return lead;
  }

  /** Perfil completo: relatório da lead + histórico de etapas + agenda + conversa WhatsApp. */
  async getProfile(id: string) {
    const lead = await this.findById(id);
    const [stageEvents, appointments, conversation] = await Promise.all([
      this.prisma.funnelStageEvent.findMany({
        where: { clientId: id },
        include: { changedByUser: { select: { id: true, name: true } } },
        orderBy: { enteredAt: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: { clientId: id },
        include: { service: true },
        orderBy: { startAt: 'desc' },
      }),
      this.prisma.conversation.findFirst({ where: { clientId: id } }),
    ]);
    const messages = conversation
      ? await this.prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    return { lead, stageEvents, appointments, messages };
  }

  async create(dto: CreateLeadDto) {
    const existing = dto.phoneE164
      ? await this.prisma.client.findUnique({ where: { phoneE164: dto.phoneE164 } })
      : null;
    if (!existing) {
      return this.prisma.client.create({
        data: {
          phoneE164: dto.phoneE164,
          funnelStage: FunnelStage.LEAD,
          ...this.toData(dto),
          name: dto.name,
        },
      });
    }
    // O bot de WhatsApp já pode ter criado um Client "stub" no primeiro
    // contato (ClientsService.findOrCreateByPhone) — completa esse registro
    // em vez de tentar duplicar o telefone (único).
    if (existing.funnelStage !== FunnelStage.LEAD || existing.pipelineStage) {
      throw new ConflictException('Já existe um registro (lead/pipeline/cliente) para esse WhatsApp.');
    }
    return this.prisma.client.update({ where: { id: existing.id }, data: this.toData(dto) });
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findById(id);
    return this.prisma.client.update({ where: { id }, data: this.toData(dto) });
  }

  async advanceToPipeline(id: string, userId?: string, reason?: string) {
    const lead = await this.findById(id);
    if (lead.funnelStage !== FunnelStage.LEAD) {
      throw new BadRequestException('Essa lead já está no pipeline ou já virou cliente.');
    }
    const now = new Date();
    const [, , client] = await this.prisma.$transaction([
      this.prisma.funnelStageEvent.updateMany({
        where: { clientId: id, module: 'PIPELINE', exitedAt: null },
        data: { exitedAt: now },
      }),
      this.prisma.funnelStageEvent.create({
        data: {
          clientId: id,
          module: 'PIPELINE',
          fromStage: null,
          toStage: PipelineStage.NEW,
          changedByUserId: userId,
          reason,
          enteredAt: now,
        },
      }),
      this.prisma.client.update({
        where: { id },
        data: {
          funnelStage: FunnelStage.PIPELINE,
          pipelineStage: PipelineStage.NEW,
          pipelineStageEnteredAt: now,
        },
      }),
    ]);
    return client;
  }

  private toData(dto: CreateLeadDto | UpdateLeadDto) {
    return {
      name: dto.name,
      instagram: dto.instagram,
      city: dto.city,
      profession: dto.profession,
      leadSource: dto.leadSource,
      leadSourceContentRef: dto.leadSourceContentRef,
      painPoints: dto.painPoints,
      desires: dto.desires,
      objections: dto.objections,
      leadNotes: dto.leadNotes,
    };
  }
}
