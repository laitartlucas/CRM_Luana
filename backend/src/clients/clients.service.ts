import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, FunnelStage, MediaSource, SuccessStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddMediaDto } from './dto/add-media.dto';
import { CLIENT_SUCCESS_EVENTS } from './client.events';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
    private readonly events: EventEmitter2,
  ) {}

  // "Clientes" (ficha completa) = quem já fechou (Módulo 3). Leads e cards
  // do Pipeline Comercial têm suas próprias listas em LeadsService/PipelineService,
  // sobre o mesmo Client — ver funnelStage.
  async list(search?: string) {
    return this.prisma.client.findMany({
      where: {
        funnelStage: FunnelStage.CLIENT,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { phoneE164: { contains: search } },
            ]
          : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    return client;
  }

  async findByPhone(phoneE164: string) {
    return this.prisma.client.findUnique({ where: { phoneE164 } });
  }

  /**
   * Usado pelo motor de conversa ao receber a primeira mensagem de um
   * número novo. Não marca consentimento automaticamente — o fluxo de
   * onboarding (ver ConversationEngineService) pergunta o nome e confirma
   * o consentimento LGPD antes de liberar o menu principal.
   */
  async findOrCreateByPhone(phoneE164: string) {
    const existing = await this.findByPhone(phoneE164);
    if (existing) return existing;
    return this.prisma.client.create({
      data: { phoneE164, name: '' },
    });
  }

  async setName(id: string, name: string) {
    return this.prisma.client.update({ where: { id }, data: { name } });
  }

  async create(dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        ...dto,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        whatsappConsentAt: dto.whatsappConsent ? new Date() : undefined,
        marketingConsentAt: dto.marketingConsent ? new Date() : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findById(id);
    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      },
    });
  }

  /** Ficha completa: dados do cliente + histórico de atendimentos + mídia. */
  async getProfile(id: string) {
    const client = await this.findById(id);
    const [appointments, media] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { clientId: id },
        include: { service: true, professional: { select: { id: true, name: true } } },
        orderBy: { startAt: 'desc' },
      }),
      this.prisma.clientMedia.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { client, appointments, media };
  }

  async addMediaFromUpload(clientId: string, file: Express.Multer.File, dto: AddMediaDto) {
    await this.findById(clientId);
    const url = await this.storage.save(`clients/${clientId}`, file.originalname, file.buffer);
    return this.prisma.clientMedia.create({
      data: {
        clientId,
        storageUrl: url,
        type: dto.type ?? 'PHOTO',
        source: MediaSource.UPLOAD,
        caption: dto.caption,
        appointmentId: dto.appointmentId,
      },
    });
  }

  /** Usado pelo módulo whatsapp quando a cliente envia uma foto pelo chat. */
  async addMediaFromWhatsapp(params: {
    clientId: string;
    storageUrl: string;
    caption?: string;
    appointmentId?: string;
  }) {
    return this.prisma.clientMedia.create({
      data: {
        clientId: params.clientId,
        storageUrl: params.storageUrl,
        type: 'PHOTO',
        source: MediaSource.WHATSAPP,
        caption: params.caption,
        appointmentId: params.appointmentId,
      },
    });
  }

  async setConsent(id: string, field: 'whatsappConsent' | 'marketingConsent', value: boolean) {
    await this.findById(id);
    const timestampField = field === 'whatsappConsent' ? 'whatsappConsentAt' : 'marketingConsentAt';
    return this.prisma.client.update({
      where: { id },
      data: { [field]: value, [timestampField]: value ? new Date() : null },
    });
  }

  /**
   * Direito de exclusão da LGPD: anonimiza PII mas preserva o registro para
   * não quebrar relatórios agregados históricos (agendamentos permanecem,
   * mas não é mais possível identificar a pessoa).
   */
  async anonymize(id: string) {
    await this.findById(id);
    return this.prisma.client.update({
      where: { id },
      data: {
        name: 'Cliente anonimizado',
        phoneE164: `anon-${id}`,
        email: null,
        birthday: null,
        bodyType: null,
        colorPalette: null,
        predominantStyle: null,
        preferredBrands: [],
        restrictions: null,
        notes: null,
        whatsappConsent: false,
        marketingConsent: false,
        anonymizedAt: new Date(),
      },
    });
  }

  // -----------------------------------------------------------------
  // Módulo 3 — Sucesso do Cliente (kanban de 8 etapas)
  // -----------------------------------------------------------------

  async successBoard() {
    const clients = await this.prisma.client.findMany({
      where: { funnelStage: FunnelStage.CLIENT },
      orderBy: { successStageEnteredAt: 'asc' },
    });
    const columns = Object.fromEntries(Object.values(SuccessStage).map((stage) => [stage, [] as Client[]]));
    for (const client of clients) {
      if (client.successStage) columns[client.successStage].push(client);
    }
    return columns;
  }

  async changeSuccessStage(id: string, toStage: SuccessStage, userId?: string, reason?: string) {
    const client = await this.findById(id);
    if (client.funnelStage !== FunnelStage.CLIENT) {
      throw new BadRequestException('Esse registro ainda não está no módulo Sucesso do Cliente.');
    }

    const now = new Date();
    const fromStage = client.successStage;
    const results = await this.prisma.$transaction([
      this.prisma.funnelStageEvent.updateMany({
        where: { clientId: id, module: 'SUCCESS', exitedAt: null },
        data: { exitedAt: now },
      }),
      this.prisma.funnelStageEvent.create({
        data: { clientId: id, module: 'SUCCESS', fromStage, toStage, changedByUserId: userId, reason, enteredAt: now },
      }),
      this.prisma.client.update({
        where: { id },
        data: { successStage: toStage, successStageEnteredAt: now },
      }),
    ]);
    const updated = results[results.length - 1] as Client;

    this.events.emit(CLIENT_SUCCESS_EVENTS.STAGE_CHANGED, { clientId: id, fromStage, toStage });
    return updated;
  }

  // -----------------------------------------------------------------
  // Previsão de no-show (diferencial de IA) — `noShowScore` existe no
  // schema desde o MVP mas nunca foi calculado em lugar nenhum. Recalculado
  // incrementalmente (via ClientScoringListener) a cada mudança de status
  // de Appointment, seguindo a fórmula já esboçada em
  // docs/04-plano-implementacao.md Fase 2: % de no-show histórico + atraso
  // médio de confirmação (confirmar em cima da hora é sinal de risco) +
  // cancelamentos com menos de 12h de antecedência. Heurística v1 — sem
  // dado histórico real ainda, os pesos são um ponto de partida razoável,
  // não um modelo treinado.
  // -----------------------------------------------------------------

  // -----------------------------------------------------------------
  // Exclusão — usada tanto pela tela de Clientes quanto pela de Leads
  // (mesma tabela, ver funnelStage). Appointment.client não tem onDelete
  // Cascade no schema (relação obrigatória, default é Restrict), então os
  // agendamentos precisam ser apagados antes do cliente na mesma transação.
  // Conversation/Message/ClientMedia/FunnelStageEvent já cascateiam.
  // -----------------------------------------------------------------

  async remove(id: string): Promise<{ ok: true }> {
    await this.findById(id);
    await this.prisma.$transaction([
      this.prisma.appointment.deleteMany({ where: { clientId: id } }),
      this.prisma.client.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /** Apaga TODOS os clientes/leads cadastrados. Irreversível — ver ClientsController para a confirmação exigida. */
  async removeAll(): Promise<{ deletedClients: number }> {
    const [, { count }] = await this.prisma.$transaction([
      this.prisma.appointment.deleteMany({}),
      this.prisma.client.deleteMany({}),
    ]);
    return { deletedClients: count };
  }

  async recalculateNoShowScore(clientId: string): Promise<void> {
    const appointments = await this.prisma.appointment.findMany({
      where: { clientId, status: { in: ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'CONFIRMED'] } },
      select: { status: true, startAt: true, confirmedAt: true, updatedAt: true },
    });
    if (appointments.length === 0) return;

    const total = appointments.length;
    const noShowRate = appointments.filter((a) => a.status === 'NO_SHOW').length / total;

    const confirmedOnes = appointments.filter((a) => a.confirmedAt);
    const avgConfirmDelayHours = confirmedOnes.length
      ? confirmedOnes.reduce(
          (sum, a) => sum + Math.max(0, (a.startAt.getTime() - a.confirmedAt!.getTime()) / 3_600_000),
          0,
        ) / confirmedOnes.length
      : 24; // sem histórico de confirmação = neutro, não penaliza nem bonifica
    const lateConfirmRisk = avgConfirmDelayHours < 2 ? 1 : avgConfirmDelayHours < 12 ? 0.5 : 0;

    const lateCancels = appointments.filter(
      (a) => a.status === 'CANCELLED' && a.startAt.getTime() - a.updatedAt.getTime() < 12 * 3_600_000,
    ).length;
    const lateCancelRate = lateCancels / total;

    const score = Math.max(0, Math.min(1, noShowRate * 0.6 + lateConfirmRisk * 0.2 + lateCancelRate * 0.2));
    await this.prisma.client.update({ where: { id: clientId }, data: { noShowScore: score } });
  }
}
