import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { WHATSAPP_PROVIDER, WhatsappProvider } from '../providers/whatsapp-provider.interface';
import { WHATSAPP_SEND_QUEUE } from './queue.constants';

@Processor(WHATSAPP_SEND_QUEUE)
export class WhatsappSendProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsappProvider,
  ) {
    super();
  }

  async process(job: Job<{ messageId: string }>): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: job.data.messageId },
      include: { conversation: true },
    });
    if (!message) return;

    try {
      const result = await this.provider.sendText(message.conversation.externalId, message.content ?? '');
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENT', providerMessageId: result.providerMessageId },
      });
    } catch (err) {
      this.logger.warn(`Falha ao enviar mensagem ${message.id}: ${(err as Error).message}`);
      await this.prisma.message.update({ where: { id: message.id }, data: { status: 'FAILED' } });
      throw err; // deixa o BullMQ reagendar retry com backoff
    }
  }
}
