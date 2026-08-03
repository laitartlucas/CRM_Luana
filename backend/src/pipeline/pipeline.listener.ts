import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { UsersService } from '../users/users.service';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '../appointments/appointment.events';
import { PIPELINE_EVENTS, PipelineStageChangedPayload } from './pipeline.events';
import { COMMERCIAL_CALL_SERVICE_NAME, PIPELINE_QUEUE } from './queue.constants';

/**
 * Reage à mudança de etapa do Pipeline só para efeitos colaterais
 * "melhor esforço" — a consistência do funil em si já foi garantida
 * atomicamente pelo PipelineService. Uma falha aqui nunca desfaz a
 * transição de etapa já persistida (mesmo isolamento de falha usado por
 * calendar-sync/notifications para Appointment).
 */
@Injectable()
export class PipelineListener {
  private readonly logger = new Logger(PipelineListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly usersService: UsersService,
    @InjectQueue(PIPELINE_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * "Call agendada" = criar um Appointment normal (purpose=COMMERCIAL_CALL).
   * Isso já dispara, de graça, o sync com Google Calendar e os lembretes
   * 24h/1h via WhatsApp (listeners existentes de calendar-sync/notifications
   * reagem a APPOINTMENT_EVENTS.CREATED) — nenhum código novo de agenda ou
   * WhatsApp precisa existir para cumprir essa automação do Módulo 2.
   */
  @OnEvent(PIPELINE_EVENTS.STAGE_CHANGED)
  async onStageChanged(payload: PipelineStageChangedPayload) {
    if (payload.toStage !== 'CALL_SCHEDULED' || !payload.callDate) return;

    try {
      const [service, professional] = await Promise.all([
        this.prisma.service.findFirst({ where: { name: COMMERCIAL_CALL_SERVICE_NAME } }),
        this.usersService.getDefaultProfessional(),
      ]);
      if (!service) {
        this.logger.warn(`Serviço "${COMMERCIAL_CALL_SERVICE_NAME}" não encontrado — rode o seed.`);
        return;
      }

      const appointment = await this.appointmentsService.create({
        professionalId: professional.id,
        clientId: payload.client.id,
        serviceId: service.id,
        startAt: payload.callDate.toISOString(),
        source: 'WEB',
        purpose: 'COMMERCIAL_CALL',
      });

      await this.scheduleNoShowCheck(appointment.id, appointment.endAt);
    } catch (err) {
      this.logger.warn(`Falha ao criar call comercial para cliente ${payload.client.id}: ${(err as Error).message}`);
    }
  }

  /**
   * Fecha uma lacuna do restante do sistema: hoje nenhum Appointment vira
   * NO_SHOW sozinho (sempre é PATCH manual). Para a call comercial,
   * agendamos uma checagem no fim do horário — se ainda estiver
   * SCHEDULED/CONFIRMED, marca no-show automaticamente. Escopo limitado a
   * calls comerciais: não altera o comportamento manual das consultorias
   * de estilo.
   */
  private async scheduleNoShowCheck(appointmentId: string, endAt: Date) {
    const delay = endAt.getTime() - Date.now();
    if (delay <= 0) return;
    await this.queue
      .add(
        'call-noshow-check',
        { appointmentId },
        { jobId: `call-noshow-check-${appointmentId}`, delay, attempts: 3 },
      )
      .catch((err) => this.logger.warn(`Falha ao agendar checagem de no-show da call: ${err.message}`));
  }

  /**
   * A mensagem de reengajamento por WhatsApp já é disparada automaticamente
   * pelo NotificationsListener (reage a qualquer APPOINTMENT_EVENTS.NO_SHOW,
   * independente do purpose) — aqui só cuidamos de mover o card no kanban.
   */
  @OnEvent(APPOINTMENT_EVENTS.NO_SHOW)
  async onAppointmentNoShow(payload: AppointmentEventPayload) {
    if (payload.appointment.purpose !== 'COMMERCIAL_CALL') return;

    const client = await this.prisma.client.findUnique({ where: { id: payload.appointment.clientId } });
    if (!client || client.funnelStage !== 'PIPELINE' || client.pipelineStage === 'NO_SHOW') return;

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.funnelStageEvent.updateMany({
        where: { clientId: client.id, module: 'PIPELINE', exitedAt: null },
        data: { exitedAt: now },
      }),
      this.prisma.funnelStageEvent.create({
        data: {
          clientId: client.id,
          module: 'PIPELINE',
          fromStage: client.pipelineStage,
          toStage: 'NO_SHOW',
          reason: 'Automático: não confirmado após o horário da call',
          enteredAt: now,
        },
      }),
      this.prisma.client.update({
        where: { id: client.id },
        data: { pipelineStage: 'NO_SHOW', pipelineStageEnteredAt: now },
      }),
    ]);
  }
}
