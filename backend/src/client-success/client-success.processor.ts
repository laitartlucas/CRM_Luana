import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappOutboundService } from '../whatsapp/whatsapp-outbound.service';
import { resolveMessageTemplate } from '../whatsapp/message-templates';
import { UsersService } from '../users/users.service';
import { CLIENT_SUCCESS_QUEUE } from './queue.constants';

@Processor(CLIENT_SUCCESS_QUEUE)
export class ClientSuccessProcessor extends WorkerHost {
  private readonly logger = new Logger(ClientSuccessProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: WhatsappOutboundService,
    private readonly usersService: UsersService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'renewal-reminder':
        return this.sendRenewalReminder(job.data.clientId);
      default:
        this.logger.warn(`Job desconhecido na fila ${CLIENT_SUCCESS_QUEUE}: ${job.name}`);
    }
  }

  private async sendRenewalReminder(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    // Só envia se ainda estiver "Encerramento" — se já virou Renovação/Indicação
    // ou saiu do módulo Sucesso do Cliente entretanto, o lembrete não faz sentido.
    if (!client || client.successStage !== 'CLOSED') return;
    const professional = await this.usersService.getDefaultProfessional();
    const text = resolveMessageTemplate('renewalReminder', professional.messageTemplates as any, {
      cliente: client.name ?? '',
    });
    await this.outbound.sendToClient(clientId, text);
  }
}
