import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientScoringListener } from './client-scoring.listener';
import { IntakeModule } from '../intake/intake.module';

@Module({
  imports: [IntakeModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientScoringListener],
  exports: [ClientsService],
})
export class ClientsModule {}
