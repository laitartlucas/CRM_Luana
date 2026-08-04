import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappOutboundService } from '../whatsapp/whatsapp-outbound.service';
import { resolveMessageTemplate } from '../whatsapp/message-templates';
import { NOTIFICATIONS_QUEUE } from './queue.constants';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: WhatsappOutboundService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'reminder':
        return this.sendReminder(job.data.appointmentId, job.data.hoursBefore);
      case 'post-service-followup':
        return this.sendPostServiceFollowUp(job.data.appointmentId);
      case 'no-show-followup':
        return this.sendNoShowReengagement(job.data.appointmentId);
      default:
        this.logger.warn(`Job desconhecido na fila ${NOTIFICATIONS_QUEUE}: ${job.name}`);
    }
  }

  private async loadAppointment(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true, service: true, professional: true },
    });
  }

  private async sendReminder(appointmentId: string, hoursBefore: number) {
    const appointment = await this.loadAppointment(appointmentId);
    if (!appointment || !['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) return;

    const tz = appointment.professional.timezone;
    const vars = {
      cliente: appointment.client.name ?? '',
      servico: appointment.service.name,
      data: formatInTimeZone(appointment.startAt, tz, 'dd/MM'),
      hora: formatInTimeZone(appointment.startAt, tz, 'HH:mm'),
    };
    const key = hoursBefore === 24 ? 'reminder24h' : hoursBefore === 3 ? 'reminder3h' : 'reminder1h';
    const text = resolveMessageTemplate(key, appointment.professional.messageTemplates as any, vars);

    await this.outbound.sendToClient(appointment.clientId, text);
    // O lembrete extra de risco alto (3h) não tem coluna própria — só o
    // envio precisa ser idempotente (jobId determinístico já garante isso).
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: hoursBefore === 24 ? { reminded24hAt: new Date() } : hoursBefore === 1 ? { reminded1hAt: new Date() } : {},
    });
  }

  private async sendPostServiceFollowUp(appointmentId: string) {
    const appointment = await this.loadAppointment(appointmentId);
    if (!appointment || appointment.status !== 'COMPLETED') return;
    const text = resolveMessageTemplate('postServiceFollowUp', appointment.professional.messageTemplates as any, {
      cliente: appointment.client.name ?? '',
      servico: appointment.service.name,
    });
    await this.outbound.sendToClient(appointment.clientId, text);
  }

  private async sendNoShowReengagement(appointmentId: string) {
    const appointment = await this.loadAppointment(appointmentId);
    if (!appointment || appointment.status !== 'NO_SHOW') return;
    const text = resolveMessageTemplate('noShowReengagement', appointment.professional.messageTemplates as any, {
      cliente: appointment.client.name ?? '',
      servico: appointment.service.name,
    });
    await this.outbound.sendToClient(appointment.clientId, text);
  }
}
