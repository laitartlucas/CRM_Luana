import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Appointment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATIONS_QUEUE, FOLLOWUP_DAYS_AFTER, NO_SHOW_REENGAGEMENT_DELAY_MS } from './queue.constants';

const REMINDER_WINDOWS_HOURS = [24, 1];
// Previsão de no-show (diferencial de IA — ver ClientsService.recalculateNoShowScore):
// clientes com score alto ganham um lembrete extra mais perto do horário.
const HIGH_RISK_EXTRA_HOURS = 3;
const HIGH_RISK_NO_SHOW_THRESHOLD = 0.5;
const ALL_POSSIBLE_WINDOWS_HOURS = [...REMINDER_WINDOWS_HOURS, HIGH_RISK_EXTRA_HOURS];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  private reminderJobId(appointmentId: string, hoursBefore: number) {
    return `reminder-${hoursBefore}h-${appointmentId}`;
  }

  /** Agenda (ou reagenda) os lembretes de 24h e 1h antes do horário. */
  async scheduleReminders(appointment: Appointment): Promise<void> {
    await this.cancelReminders(appointment.id);

    const client = await this.prisma.client.findUnique({
      where: { id: appointment.clientId },
      select: { noShowScore: true },
    });
    const windows = [...REMINDER_WINDOWS_HOURS];
    if ((client?.noShowScore ?? 0) >= HIGH_RISK_NO_SHOW_THRESHOLD) {
      windows.push(HIGH_RISK_EXTRA_HOURS);
    }

    for (const hoursBefore of windows) {
      const fireAt = appointment.startAt.getTime() - hoursBefore * 60 * 60 * 1000;
      const delay = fireAt - Date.now();
      if (delay <= 0) continue; // já passou desse ponto — não manda lembrete "atrasado"

      await this.queue
        .add(
          'reminder',
          { appointmentId: appointment.id, hoursBefore },
          { jobId: this.reminderJobId(appointment.id, hoursBefore), delay, attempts: 5, backoff: { type: 'exponential', delay: 30_000 } },
        )
        .catch((err) => this.logger.warn(`Falha ao agendar lembrete de ${hoursBefore}h: ${err.message}`));
    }
  }

  async cancelReminders(appointmentId: string): Promise<void> {
    for (const hoursBefore of ALL_POSSIBLE_WINDOWS_HOURS) {
      const job = await this.queue.getJob(this.reminderJobId(appointmentId, hoursBefore));
      await job?.remove().catch(() => undefined);
    }
  }

  async scheduleFollowUp(appointment: Appointment): Promise<void> {
    const delay = FOLLOWUP_DAYS_AFTER * 24 * 60 * 60 * 1000;
    await this.queue
      .add(
        'post-service-followup',
        { appointmentId: appointment.id },
        { jobId: `followup-${appointment.id}`, delay, attempts: 3 },
      )
      .catch((err) => this.logger.warn(`Falha ao agendar follow-up: ${err.message}`));
  }

  async scheduleNoShowReengagement(appointment: Appointment): Promise<void> {
    await this.queue
      .add(
        'no-show-followup',
        { appointmentId: appointment.id },
        { jobId: `noshow-${appointment.id}`, delay: NO_SHOW_REENGAGEMENT_DELAY_MS, attempts: 3 },
      )
      .catch((err) => this.logger.warn(`Falha ao agendar reengajamento de no-show: ${err.message}`));
  }
}
