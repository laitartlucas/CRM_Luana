import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxListener } from './inbox.listener';
import { InboxProcessor, InboxScheduler, INBOX_QUEUE } from './inbox.scheduler';
import { InboxScanner } from './inbox.scanner';
import { InboxService } from './inbox.service';

@Module({
  imports: [BullModule.registerQueue({ name: INBOX_QUEUE })],
  controllers: [InboxController],
  providers: [InboxService, InboxScanner, InboxListener, InboxScheduler, InboxProcessor],
  exports: [InboxService],
})
export class InboxModule {}
