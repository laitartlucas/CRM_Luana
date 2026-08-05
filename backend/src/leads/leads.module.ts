import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { RespondiImportService } from './respondi-import.service';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [ClientsModule],
  controllers: [LeadsController],
  providers: [LeadsService, RespondiImportService],
  exports: [LeadsService],
})
export class LeadsModule {}
