import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PIPELINE_QUEUE } from './queue.constants';

const STILL_PENDING_STATUSES: AppointmentStatus[] = [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];

@Processor(PIPELINE_QUEUE)
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'call-noshow-check':
        return this.checkCallNoShow(job.data.appointmentId);
      default:
        this.logger.warn(`Job desconhecido na fila ${PIPELINE_QUEUE}: ${job.name}`);
    }
  }

  private async checkCallNoShow(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment || !STILL_PENDING_STATUSES.includes(appointment.status)) return;
    await this.appointmentsService.markNoShow(appointmentId);
  }
}
