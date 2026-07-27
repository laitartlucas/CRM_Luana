import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CalendarSyncService } from './calendar-sync.service';
import { CALENDAR_SYNC_QUEUE } from './queue.constants';

@Processor(CALENDAR_SYNC_QUEUE)
export class CalendarSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarSyncProcessor.name);

  constructor(private readonly calendarSyncService: CalendarSyncService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'upsert-event':
        return this.calendarSyncService.upsertEventForAppointment(job.data.appointmentId);
      case 'delete-event':
        return this.calendarSyncService.deleteEventForAppointment(
          job.data.appointmentId,
          job.data.googleEventId,
        );
      case 'incremental-sync':
        return this.calendarSyncService.runIncrementalSync(job.data.channelId);
      case 'register-watch':
        return this.calendarSyncService.registerWatchChannel(job.data.professionalId);
      default:
        this.logger.warn(`Job desconhecido na fila ${CALENDAR_SYNC_QUEUE}: ${job.name}`);
    }
  }
}
