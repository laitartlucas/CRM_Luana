import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineListener } from './pipeline.listener';
import { PipelineProcessor } from './pipeline.processor';
import { PIPELINE_QUEUE } from './queue.constants';
import { AppointmentsModule } from '../appointments/appointments.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [BullModule.registerQueue({ name: PIPELINE_QUEUE }), AppointmentsModule, UsersModule],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineListener, PipelineProcessor],
  exports: [PipelineService],
})
export class PipelineModule {}
