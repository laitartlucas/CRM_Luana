import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappOutboundService } from './whatsapp-outbound.service';
import { WhatsappSendProcessor } from './send-queue/whatsapp-send.processor';
import { WHATSAPP_SEND_QUEUE } from './send-queue/queue.constants';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { MetaWhatsappProvider } from './providers/meta-whatsapp.provider';
import { ConversationEngineService } from './conversation/conversation-engine.service';
import { ClientsModule } from '../clients/clients.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: WHATSAPP_SEND_QUEUE }),
    ClientsModule,
    CatalogModule,
    AppointmentsModule,
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappOutboundService,
    WhatsappSendProcessor,
    ConversationEngineService,
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (config: ConfigService, metaProvider: MetaWhatsappProvider, mockProvider: MockWhatsappProvider) =>
        config.get<string>('WHATSAPP_PROVIDER') === 'meta' ? metaProvider : mockProvider,
      inject: [ConfigService, MetaWhatsappProvider, MockWhatsappProvider],
    },
    MetaWhatsappProvider,
    MockWhatsappProvider,
  ],
  exports: [WhatsappOutboundService],
})
export class WhatsappModule {}
