import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncListener } from './calendar-sync.listener';
import { CalendarSyncProcessor } from './calendar-sync.processor';
import { CALENDAR_SYNC_QUEUE } from './queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: CALENDAR_SYNC_QUEUE })],
  controllers: [CalendarSyncController],
  providers: [CalendarSyncService, CalendarSyncListener, CalendarSyncProcessor],
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}
