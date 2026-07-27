import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WHATSAPP_SEND_QUEUE } from './send-queue/queue.constants';

@Injectable()
export class WhatsappOutboundService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WHATSAPP_SEND_QUEUE) private readonly sendQueue: Queue,
  ) {}

  private async findOrCreateConversation(clientId: string) {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    return this.prisma.conversation.upsert({
      where: { channel_externalId: { channel: 'WHATSAPP', externalId: client.phoneE164 } },
      create: { clientId, channel: 'WHATSAPP', externalId: client.phoneE164 },
      update: {},
    });
  }

  /** Enfileira uma mensagem de saída (lembretes, follow-ups, respostas do bot). */
  async sendToClient(clientId: string, text: string): Promise<void> {
    const conversation = await this.findOrCreateConversation(clientId);
    await this.sendToConversation(conversation.id, text);
  }

  async sendToConversation(conversationId: string, text: string): Promise<void> {
    const message = await this.prisma.message.create({
      data: { conversationId, direction: 'OUT', type: 'TEXT', content: text, status: 'QUEUED' },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    await this.sendQueue.add(
      'send-message',
      { messageId: message.id },
      { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } },
    );
  }
}
