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
import { EvolutionWhatsappProvider } from './providers/evolution-whatsapp.provider';
import { ConversationEngineService } from './conversation/conversation-engine.service';
import { NluService } from './conversation/nlu.service';
import { ClientsModule } from '../clients/clients.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: WHATSAPP_SEND_QUEUE }),
    ClientsModule,
    CatalogModule,
    AppointmentsModule,
    UsersModule,
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappOutboundService,
    WhatsappSendProcessor,
    ConversationEngineService,
    NluService,
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (
        config: ConfigService,
        metaProvider: MetaWhatsappProvider,
        mockProvider: MockWhatsappProvider,
        evolutionProvider: EvolutionWhatsappProvider,
      ) => {
        const provider = config.get<string>('WHATSAPP_PROVIDER');
        if (provider === 'meta') return metaProvider;
        if (provider === 'evolution') return evolutionProvider;
        return mockProvider;
      },
      inject: [ConfigService, MetaWhatsappProvider, MockWhatsappProvider, EvolutionWhatsappProvider],
    },
    MetaWhatsappProvider,
    MockWhatsappProvider,
    EvolutionWhatsappProvider,
  ],
  exports: [WhatsappOutboundService],
})
export class WhatsappModule {}
