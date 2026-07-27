import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AddMediaDto } from './dto/add-media.dto';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  async list(search?: string) {
    return this.prisma.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phoneE164: { contains: search } },
            ],
          }
        : undefined,
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
}
