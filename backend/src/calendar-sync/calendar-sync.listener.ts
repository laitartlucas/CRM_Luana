import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '../appointments/appointment.events';
import { CALENDAR_SYNC_QUEUE } from './queue.constants';

/**
 * Ponte entre o núcleo de agenda (appointments) e a fila de sincronização
 * com o Google. Nunca chama a API do Google diretamente — só enfileira.
 * Se o enqueue falhar (Redis fora do ar), loga e segue: o agendamento já
 * foi salvo no Postgres, a sincronização pode ser refeita depois.
 */
@Injectable()
export class CalendarSyncListener {
  private readonly logger = new Logger(CalendarSyncListener.name);

  constructor(@InjectQueue(CALENDAR_SYNC_QUEUE) private readonly queue: Queue) {}

  private async safeEnqueue(name: string, data: unknown) {
    try {
      await this.queue.add(name, data, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
      });
    } catch (err) {
      this.logger.warn(`Falha ao enfileirar job '${name}' de sync com Google: ${(err as Error).message}`);
    }
  }

  @OnEvent([APPOINTMENT_EVENTS.CREATED, APPOINTMENT_EVENTS.RESCHEDULED, APPOINTMENT_EVENTS.CONFIRMED])
  async onUpsert(payload: AppointmentEventPayload) {
    if (payload.appointment.source === 'GOOGLE') return; // já veio do Google, não reenviar
    await this.safeEnqueue('upsert-event', { appointmentId: payload.appointment.id });
  }

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED)
  async onCancelled(payload: AppointmentEventPayload) {
    if (payload.appointment.source === 'GOOGLE') return;
    await this.safeEnqueue('delete-event', {
      appointmentId: payload.appointment.id,
      googleEventId: payload.appointment.googleEventId,
    });
  }
}
