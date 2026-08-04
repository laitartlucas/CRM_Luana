import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { ConversationEngineService } from './conversation/conversation-engine.service';
import { WHATSAPP_PROVIDER, WhatsappProvider } from './providers/whatsapp-provider.interface';
import { EvolutionWhatsappProvider } from './providers/evolution-whatsapp.provider';
import { LocalStorageService } from '../storage/local-storage.service';
import { SimulateInboundDto } from './dto/simulate-inbound.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { WhatsappOutboundService } from './whatsapp-outbound.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly conversationEngine: ConversationEngineService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsappProvider,
    private readonly evolutionProvider: EvolutionWhatsappProvider,
    private readonly storage: LocalStorageService,
    private readonly prisma: PrismaService,
    private readonly outbound: WhatsappOutboundService,
  ) {}

  /** Envio manual de mensagem pela consultora, direto da ficha do cliente/lead. */
  @UseGuards(RolesGuard)
  @Post('send')
  async sendManual(@Body() dto: SendMessageDto) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    await this.outbound.sendToClient(dto.clientId, dto.text);
    return { ok: true };
  }

  /** Verificação do webhook exigida pela Meta ao cadastrar a URL. */
  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    if (mode === 'subscribe' && token === this.config.get<string>('WHATSAPP_META_VERIFY_TOKEN')) {
      return challenge;
    }
    throw new BadRequestException('Verify token inválido.');
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: Request,
  ) {
    const appSecret = this.config.get<string>('WHATSAPP_META_APP_SECRET');
    if (appSecret && (req as any).rawBody) {
      const valid = this.verifySignature((req as any).rawBody, signature, appSecret);
      if (!valid) {
        this.logger.warn('Assinatura do webhook do WhatsApp inválida — ignorando payload.');
        return { ok: true };
      }
    }

    try {
      await this.processWebhookPayload(body);
    } catch (err) {
      // Nunca deixa uma falha de parsing/processamento derrubar o webhook —
      // a Meta reentrega em caso de erro HTTP, o que pioraria a situação.
      this.logger.error(`Erro ao processar webhook do WhatsApp: ${(err as Error).message}`);
    }
    return { ok: true };
  }

  /**
   * Webhook da Evolution API (conexão por QR Code, ver
   * evolution-whatsapp.provider.ts). Diferente da Meta, a Evolution não
   * assina o corpo com HMAC — o segredo no path da URL é o que protege esta
   * rota (comparado em tempo constante).
   */
  @Public()
  @Post('webhook/evolution/:secret')
  @HttpCode(HttpStatus.OK)
  async receiveEvolutionWebhook(@Param('secret') secret: string, @Body() body: any) {
    const expected = this.config.get<string>('EVOLUTION_WEBHOOK_SECRET');
    if (!expected || !this.safeCompare(secret, expected)) {
      this.logger.warn('Segredo do webhook da Evolution API inválido — ignorando payload.');
      return { ok: true };
    }

    try {
      await this.processEvolutionWebhookPayload(body);
    } catch (err) {
      this.logger.error(`Erro ao processar webhook da Evolution API: ${(err as Error).message}`);
    }
    return { ok: true };
  }

  /** Status de conexão da instância da Evolution API (usado pela tela de Configurações). */
  @UseGuards(RolesGuard)
  @Get('evolution/status')
  async evolutionStatus() {
    const state = await this.evolutionProvider.getConnectionState();
    return { connected: state === 'open', state };
  }

  /** Garante a instância criada + webhook configurado e devolve o QR Code pra escanear. */
  @UseGuards(RolesGuard)
  @Post('evolution/connect')
  async evolutionConnect() {
    const secret = this.config.get<string>('EVOLUTION_WEBHOOK_SECRET');
    const publicUrl = this.config.get<string>('API_PUBLIC_URL');
    if (!secret || !publicUrl) {
      throw new BadRequestException('EVOLUTION_WEBHOOK_SECRET e API_PUBLIC_URL precisam estar configurados.');
    }
    const webhookUrl = `${publicUrl}/whatsapp/webhook/evolution/${secret}`;
    await this.evolutionProvider.ensureInstance(webhookUrl);
    const qrCodeBase64 = await this.evolutionProvider.getQrCode();
    return { qrCodeBase64 };
  }

  private safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private verifySignature(rawBody: Buffer, signatureHeader: string, appSecret: string): boolean {
    if (!signatureHeader?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace('sha256=', '');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  private async processWebhookPayload(body: any) {
    const changes = body?.entry?.flatMap((e: any) => e.changes ?? []) ?? [];
    for (const change of changes) {
      const value = change.value;
      const contact = value?.contacts?.[0];
      for (const message of value?.messages ?? []) {
        const phoneE164 = `+${message.from}`;
        let mediaSavedUrl: string | undefined;
        let text: string | undefined = message.text?.body;

        if (message.type === 'image' && message.image?.id) {
          const media = await this.provider.downloadMedia(message.image.id);
          mediaSavedUrl = await this.storage.save('whatsapp-media', media.filename, media.buffer);
          text = message.image.caption ?? text;
        }

        await this.conversationEngine.handleIncoming({
          phoneE164,
          profileName: contact?.profile?.name,
          providerMessageId: message.id,
          text,
          mediaSavedUrl,
        });
      }
    }
  }

  /**
   * Evento `messages.upsert` da Evolution API. Formato de payload difere da
   * Meta (mensagem única em `data`, não um array em `entry[].changes[]`), e
   * a mídia já vem embutida em base64 no próprio payload (instância criada
   * com `webhook.base64=true`, ver ensureInstance), sem precisar de uma
   * segunda chamada pra baixar como no fluxo da Meta.
   */
  private async processEvolutionWebhookPayload(body: any) {
    if (body?.event !== 'messages.upsert') return;
    const data = body?.data;
    const key = data?.key;
    if (!data || !key) return;
    if (key.fromMe) return; // mensagem enviada pelo próprio número conectado (app normal do celular)
    const remoteJid: string | undefined = key.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us')) return; // ignora mensagens de grupo

    const phoneE164 = `+${remoteJid.split('@')[0]}`;
    const message = data.message ?? {};
    let text: string | undefined = message.conversation ?? message.extendedTextMessage?.text;
    let mediaSavedUrl: string | undefined;

    const image = message.imageMessage;
    if (image?.base64) {
      const buffer = Buffer.from(image.base64, 'base64');
      const mimeType: string = image.mimetype ?? 'image/jpeg';
      const extension = mimeType.split('/')[1] ?? 'jpg';
      mediaSavedUrl = await this.storage.save('whatsapp-media', `${key.id}.${extension}`, buffer);
      text = image.caption ?? text;
    }

    await this.conversationEngine.handleIncoming({
      phoneE164,
      providerMessageId: key.id ?? `evo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      mediaSavedUrl,
    });
  }

  /**
   * Ferramenta de desenvolvimento/demo: simula uma mensagem inbound sem
   * depender da Meta Cloud API estar configurada. Usa o mesmo motor de
   * conversa do fluxo real. Ver README para o passo a passo de teste.
   */
  @UseGuards(RolesGuard)
  @Post('simulate/inbound')
  async simulateInbound(@Body() dto: SimulateInboundDto) {
    await this.conversationEngine.handleIncoming({
      phoneE164: dto.phoneE164,
      providerMessageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: dto.text,
    });
    const conversation = await this.prisma.conversation.findFirst({
      where: { externalId: dto.phoneE164, channel: 'WHATSAPP' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    return conversation;
  }
}
