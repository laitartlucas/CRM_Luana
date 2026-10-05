import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [LeadsModule, PipelineModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
