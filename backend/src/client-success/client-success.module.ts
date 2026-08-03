import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClientSuccessService } from './client-success.service';
import { ClientSuccessListener } from './client-success.listener';
import { ClientSuccessProcessor } from './client-success.processor';
import { CLIENT_SUCCESS_QUEUE } from './queue.constants';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [BullModule.registerQueue({ name: CLIENT_SUCCESS_QUEUE }), WhatsappModule],
  providers: [ClientSuccessService, ClientSuccessListener, ClientSuccessProcessor],
  exports: [ClientSuccessService],
})
export class ClientSuccessModule {}
