import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappOutboundService } from '../whatsapp/whatsapp-outbound.service';
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

    const when = formatInTimeZone(appointment.startAt, appointment.professional.timezone, "dd/MM 'às' HH:mm");
    const text =
      hoursBefore === 24
        ? `Lembrete: você tem "${appointment.service.name}" amanhã, ${when}. Confirma?\n1) Confirmar\n2) Remarcar`
        : `Falta 1h para "${appointment.service.name}" (${when}). Te espero! Se precisar, digite "2" para remarcar.`;

    await this.outbound.sendToClient(appointment.clientId, text);
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: hoursBefore === 24 ? { reminded24hAt: new Date() } : { reminded1hAt: new Date() },
    });
  }

  private async sendPostServiceFollowUp(appointmentId: string) {
    const appointment = await this.loadAppointment(appointmentId);
    if (!appointment || appointment.status !== 'COMPLETED') return;
    await this.outbound.sendToClient(
      appointment.clientId,
      `Oi ${appointment.client.name}! Como foi sua experiência com os looks de "${appointment.service.name}"? Conta pra gente 💛`,
    );
  }

  private async sendNoShowReengagement(appointmentId: string) {
    const appointment = await this.loadAppointment(appointmentId);
    if (!appointment || appointment.status !== 'NO_SHOW') return;
    await this.outbound.sendToClient(
      appointment.clientId,
      `Oi ${appointment.client.name}, sentimos sua falta no horário de "${appointment.service.name}". Quer remarcar? Digite "2" para ver novos horários.`,
    );
  }
}
