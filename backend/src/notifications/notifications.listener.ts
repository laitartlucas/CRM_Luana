import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '../appointments/appointment.events';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent([APPOINTMENT_EVENTS.CREATED, APPOINTMENT_EVENTS.RESCHEDULED, APPOINTMENT_EVENTS.CONFIRMED])
  async onScheduleChanged(payload: AppointmentEventPayload) {
    await this.notifications.scheduleReminders(payload.appointment);
  }

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED)
  async onCancelled(payload: AppointmentEventPayload) {
    await this.notifications.cancelReminders(payload.appointment.id);
  }

  @OnEvent(APPOINTMENT_EVENTS.COMPLETED)
  async onCompleted(payload: AppointmentEventPayload) {
    await this.notifications.scheduleFollowUp(payload.appointment);
  }

  @OnEvent(APPOINTMENT_EVENTS.NO_SHOW)
  async onNoShow(payload: AppointmentEventPayload) {
    await this.notifications.scheduleNoShowReengagement(payload.appointment);
  }
}
