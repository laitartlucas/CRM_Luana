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
import { LocalStorageService } from '../storage/local-storage.service';
import { SimulateInboundDto } from './dto/simulate-inbound.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly conversationEngine: ConversationEngineService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsappProvider,
    private readonly storage: LocalStorageService,
    private readonly prisma: PrismaService,
  ) {}

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
