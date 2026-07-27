import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsListener } from './notifications.listener';
import { NotificationsProcessor } from './notifications.processor';
import { NOTIFICATIONS_QUEUE } from './queue.constants';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }), WhatsappModule],
  providers: [NotificationsService, NotificationsListener, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
