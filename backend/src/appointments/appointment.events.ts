import { Appointment } from '@prisma/client';

/**
 * Eventos emitidos pelo AppointmentsService. calendar-sync e notifications
 * escutam esses eventos para espelhar no Google Calendar e agendar
 * lembretes/follow-ups, respectivamente — desacoplados do núcleo de agenda,
 * conforme `docs/01-arquitetura.md` §1.2/§7 (falha nesses listeners nunca
 * deve propagar de volta para quem chamou o AppointmentsService).
 */
export const APPOINTMENT_EVENTS = {
  CREATED: 'appointment.created',
  RESCHEDULED: 'appointment.rescheduled',
  CANCELLED: 'appointment.cancelled',
  CONFIRMED: 'appointment.confirmed',
  COMPLETED: 'appointment.completed',
  NO_SHOW: 'appointment.no_show',
} as const;

export interface AppointmentEventPayload {
  appointment: Appointment;
  previous?: Appointment;
  reason?: string;
}
