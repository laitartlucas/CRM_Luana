import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppointmentSource, NotificationType } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '../appointments/appointment.events';
import { PrismaService } from '../prisma/prisma.service';
import { clientPath, InboxService } from './inbox.service';
import { LEAD_EVENTS, LeadCreatedPayload } from './lead.events';

/**
 * Transforma eventos do sistema em avisos. Como os demais listeners, nunca
 * propaga erro para quem emitiu o evento — um aviso perdido não pode
 * derrubar o cadastro de uma lead ou um agendamento.
 */
@Injectable()
export class InboxListener {
  private readonly logger = new Logger(InboxListener.name);

  constructor(
    private readonly inbox: InboxService,
    private readonly prisma: PrismaService,
  ) {}

  private async safely(label: string, work: () => Promise<unknown>) {
    try {
      await work();
    } catch (err) {
      this.logger.warn(`Falha ao criar aviso (${label}): ${(err as Error).message}`);
    }
  }

  @OnEvent(LEAD_EVENTS.CREATED)
  onLeadCreated(payload: LeadCreatedPayload) {
    return this.safely('lead', () =>
      this.inbox.notifyAllActive({
        type: NotificationType.NEW_LEAD,
        title: 'Nova lead cadastrada',
        body: payload.name || null,
        link: `/leads/${payload.leadId}`,
        dedupeKey: `lead:${payload.leadId}`,
      }),
    );
  }

  /** Só agendamentos feitos pela própria cliente (bot do WhatsApp) merecem aviso; os criados na tela já são do usuário. */
  @OnEvent(APPOINTMENT_EVENTS.CREATED)
  onAppointmentCreated({ appointment }: AppointmentEventPayload) {
    if (appointment.source !== AppointmentSource.WHATSAPP) return;
    return this.safely('agendamento', () => this.notifyProfessional(appointment, NotificationType.APPOINTMENT_BOOKED, 'Novo agendamento pelo WhatsApp', 'appt-booked'));
  }

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED)
  onAppointmentCancelled({ appointment, reason }: AppointmentEventPayload) {
    return this.safely('cancelamento', () =>
      this.notifyProfessional(appointment, NotificationType.APPOINTMENT_CANCELLED, 'Agendamento cancelado', 'appt-cancelled', reason),
    );
  }

  private async notifyProfessional(
    appointment: AppointmentEventPayload['appointment'],
    type: NotificationType,
    title: string,
    keyPrefix: string,
    reason?: string,
  ) {
    const [client, professional] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: appointment.clientId }, select: { id: true, name: true, funnelStage: true } }),
      this.prisma.user.findUnique({ where: { id: appointment.professionalId }, select: { timezone: true, active: true } }),
    ]);
    if (!client || !professional?.active) return;

    const when = formatInTimeZone(appointment.startAt, professional.timezone, "dd/MM 'às' HH:mm");
    const body = [client.name || 'Cliente', when, reason].filter(Boolean).join(' · ');
    await this.inbox.notifyUsers([appointment.professionalId], {
      type,
      title,
      body,
      link: clientPath(client),
      dedupeKey: `${keyPrefix}:${appointment.id}`,
    });
  }
}
