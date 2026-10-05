import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, FunnelStage, Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { csvDateTime, csvPercent, toCsv } from '../common/csv';
import { personSearchFilter } from '../common/utils/person-search';
import { resolvePeriod } from '../common/utils/period';
import { LeadsService } from '../leads/leads.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { PrismaService } from '../prisma/prisma.service';
import { PeriodQueryDto } from '../common/dto/period-query.dto';
import { ExportClientsQueryDto, ExportLeadsQueryDto } from './dto/export-query.dto';
import {
  FUNNEL_STAGE_LABELS,
  label,
  LEAD_SOURCE_LABELS,
  PIPELINE_STAGE_LABELS,
  SUCCESS_STAGE_LABELS,
} from './labels';

/** Teto de linhas por exportação: protege a memória do servidor; passando dele, o arquivo sai cortado e o front avisa. */
export const EXPORT_ROW_CAP = 20_000;

export interface CsvFile {
  filename: string;
  csv: string;
  rows: number;
  truncated: boolean;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly pipeline: PipelineService,
  ) {}

  private filename(base: string, user: AuthenticatedUser, now = new Date()) {
    return `${base}-${formatInTimeZone(now, user.timezone, 'yyyy-MM-dd')}.csv`;
  }

  /**
   * Exportar dados pessoais em massa precisa deixar rastro (LGPD): quem, o quê, com quais filtros
   * e quantas linhas. Falha ao registrar não bloqueia o arquivo, mas aparece no log do servidor.
   */
  private async audit(user: AuthenticatedUser, report: string, filters: object, rows: number) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          entity: 'export',
          entityId: report,
          action: AuditAction.EXPORT,
          after: { filters, rows } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao registrar exportação "${report}" no audit log: ${(err as Error).message}`);
    }
  }

  async leadsCsv(query: ExportLeadsQueryDto, user: AuthenticatedUser): Promise<CsvFile> {
    const period = resolvePeriod(query, user.timezone);
    const { total, rows } = await this.leads.listForExport(query, period, EXPORT_ROW_CAP);

    const csv = toCsv(
      ['Nome', 'WhatsApp', 'Instagram', 'E-mail', 'Cidade', 'Profissão', 'Origem', 'Situação', 'Etapa do pipeline', 'Score', 'Cadastrada em'],
      rows.map((r) => [
        r.name,
        r.phoneE164,
        r.instagram,
        r.email,
        r.city,
        r.profession,
        label(LEAD_SOURCE_LABELS, r.leadSource),
        label(FUNNEL_STAGE_LABELS, r.funnelStage),
        label(PIPELINE_STAGE_LABELS, r.pipelineStage),
        r.leadScore,
        csvDateTime(r.createdAt, user.timezone),
      ]),
    );
    await this.audit(user, 'leads', { ...query }, rows.length);
    return { filename: this.filename('leads', user), csv, rows: rows.length, truncated: total > rows.length };
  }

  async clientsCsv(query: ExportClientsQueryDto, user: AuthenticatedUser): Promise<CsvFile> {
    const { from, to } = resolvePeriod(query, user.timezone);
    const where: Prisma.ClientWhereInput = {
      AND: [
        { funnelStage: FunnelStage.CLIENT },
        query.successStage ? { successStage: query.successStage } : {},
        personSearchFilter(query.search) ?? {},
        from && to ? { createdAt: { gte: from, lte: to } } : {},
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        select: {
          name: true,
          phoneE164: true,
          email: true,
          predominantStyle: true,
          successStage: true,
          paymentMethod: true,
          noShowScore: true,
          createdAt: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: EXPORT_ROW_CAP,
      }),
    ]);

    const csv = toCsv(
      ['Nome', 'WhatsApp', 'E-mail', 'Estilo predominante', 'Etapa', 'Forma de pagamento', 'Risco de falta', 'Cadastrada em'],
      rows.map((r) => [
        r.name,
        r.phoneE164,
        r.email,
        r.predominantStyle,
        label(SUCCESS_STAGE_LABELS, r.successStage),
        r.paymentMethod,
        csvPercent(r.noShowScore),
        csvDateTime(r.createdAt, user.timezone),
      ]),
    );
    await this.audit(user, 'clients', { ...query }, rows.length);
    return { filename: this.filename('clientes', user), csv, rows: rows.length, truncated: total > rows.length };
  }

  async funnelCsv(query: PeriodQueryDto, user: AuthenticatedUser): Promise<CsvFile> {
    const { from, to } = resolvePeriod(query, user.timezone);
    const report = await this.pipeline.funnelReport(from, to);

    const rows = [
      ...report.mainPath.map((e) => ['Funil principal', label(PIPELINE_STAGE_LABELS, e.stage), e.count, csvPercent(e.conversionFromPrevious)]),
      ...report.sideStages.map((e) => ['Saída lateral', label(PIPELINE_STAGE_LABELS, e.stage), e.count, '']),
    ];
    const csv = toCsv(['Tipo', 'Etapa', 'Leads que chegaram', 'Conversão sobre a etapa anterior'], rows);
    await this.audit(user, 'funnel', { ...query }, rows.length);
    return { filename: this.filename('funil', user), csv, rows: rows.length, truncated: false };
  }

  async originsCsv(query: PeriodQueryDto, user: AuthenticatedUser): Promise<CsvFile> {
    const { from, to } = resolvePeriod(query, user.timezone);
    const entries = await this.pipeline.originReport(from, to);

    const rows = entries.map((e) => [
      label(LEAD_SOURCE_LABELS, e.leadSource as keyof typeof LEAD_SOURCE_LABELS),
      e.contentRef,
      e.leads,
      e.closedWon,
      csvPercent(e.conversionRate),
    ]);
    const csv = toCsv(['Origem', 'Conteúdo (link/descrição)', 'Leads', 'Fecharam', 'Conversão'], rows);
    await this.audit(user, 'origins', { ...query }, rows.length);
    return { filename: this.filename('origem-das-leads', user), csv, rows: rows.length, truncated: false };
  }
}
