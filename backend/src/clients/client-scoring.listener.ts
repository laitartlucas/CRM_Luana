import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '../appointments/appointment.events';
import { ClientsService } from './clients.service';

/** Mantém Client.noShowScore em dia a cada mudança de status de Appointment. */
@Injectable()
export class ClientScoringListener {
  private readonly logger = new Logger(ClientScoringListener.name);

  constructor(private readonly clientsService: ClientsService) {}

  @OnEvent([
    APPOINTMENT_EVENTS.CONFIRMED,
    APPOINTMENT_EVENTS.COMPLETED,
    APPOINTMENT_EVENTS.NO_SHOW,
    APPOINTMENT_EVENTS.CANCELLED,
  ])
  async onAppointmentStatusChanged(payload: AppointmentEventPayload) {
    await this.clientsService
      .recalculateNoShowScore(payload.appointment.clientId)
      .catch((err) => this.logger.warn(`Falha ao recalcular noShowScore: ${err.message}`));
  }
}
