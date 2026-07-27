export const CALENDAR_SYNC_QUEUE = 'calendar-sync';

export type CalendarSyncJobName = 'upsert-event' | 'delete-event' | 'incremental-sync' | 'register-watch';

export interface CalendarSyncJobData {
  appointmentId?: string;
  professionalId?: string;
  googleEventId?: string;
}
