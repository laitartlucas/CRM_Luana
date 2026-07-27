import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3, google } from 'googleapis';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { CircuitBreaker } from '../common/utils/circuit-breaker';
import { Appointment, ScheduleBlockType } from '@prisma/client';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  private readonly breaker = new CircuitBreaker(5, 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {}

  private newOAuthClient() {
    return new google.auth.OAuth2(
      this.config.get<string>('GOOGLE_CALENDAR_CLIENT_ID'),
      this.config.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET'),
      this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI'),
    );
  }

  buildConsentUrl(state: string): string {
    const client = this.newOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // garante que o refresh_token seja sempre retornado
      scope: [CALENDAR_SCOPE],
      state,
    });
  }

  async handleOAuthCallback(code: string, professionalId: string) {
    const client = this.newOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new BadRequestException(
        'Google não retornou refresh_token. Revogue o acesso do app em myaccount.google.com/permissions e tente novamente.',
      );
    }

    await this.prisma.googleCalendarConnection.upsert({
      where: { userId: professionalId },
      create: {
        userId: professionalId,
        googleCalendarId: 'primary',
        accessToken: this.crypto.encrypt(tokens.access_token),
        refreshToken: this.crypto.encrypt(tokens.refresh_token),
        expiresAt: new Date(tokens.expiry_date),
      },
      update: {
        accessToken: this.crypto.encrypt(tokens.access_token),
        refreshToken: this.crypto.encrypt(tokens.refresh_token),
        expiresAt: new Date(tokens.expiry_date),
        lastSyncError: null,
      },
    });

    await this.registerWatchChannel(professionalId).catch((err) =>
      this.logger.warn(`Falha ao registrar watch channel para ${professionalId}: ${err.message}`),
    );
  }

  private async getAuthorizedClient(professionalId: string) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: professionalId },
    });
    if (!connection) {
      throw new NotFoundException('Profissional não conectou o Google Calendar.');
    }

    const client = this.newOAuthClient();
    client.setCredentials({
      access_token: this.crypto.decrypt(connection.accessToken),
      refresh_token: this.crypto.decrypt(connection.refreshToken),
      expiry_date: connection.expiresAt.getTime(),
    });

    client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        this.prisma.googleCalendarConnection
          .update({
            where: { userId: professionalId },
            data: {
              accessToken: this.crypto.encrypt(tokens.access_token),
              expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : connection.expiresAt,
            },
          })
          .catch((err) => this.logger.warn(`Falha ao persistir token renovado: ${err.message}`));
      }
    });

    return { client, connection };
  }

  /** Mapeia um Appointment do CRM para um Event do Google Calendar. */
  private toGoogleEvent(appointment: Appointment & { client?: any; service?: any }): calendar_v3.Schema$Event {
    return {
      summary: `${appointment.service?.name ?? 'Atendimento'} — ${appointment.client?.name ?? ''}`.trim(),
      description: [
        appointment.notes,
        appointment.client?.phoneE164 ? `WhatsApp: ${appointment.client.phoneE164}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      start: { dateTime: appointment.startAt.toISOString() },
      end: { dateTime: appointment.endAt.toISOString() },
      location: appointment.location === 'ONLINE' ? 'Atendimento online' : undefined,
      extendedProperties: {
        private: { crmAppointmentId: appointment.id },
      },
    };
  }

  /**
   * Cria ou atualiza o evento espelhado no Google para um agendamento.
   * Nunca lança para quem chama de dentro de um job assíncrono — falhas
   * ficam registradas em `lastSyncError` e o job de fila decide se tenta
   * de novo (ver calendar-sync.processor.ts).
   */
  async upsertEventForAppointment(appointmentId: string): Promise<void> {
    if (this.breaker.isOpen()) {
      throw new Error('Circuito da integração com Google Calendar está aberto (falhas recentes).');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true, service: true },
    });
    if (!appointment) return;

    const hasConnection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: appointment.professionalId },
    });
    if (!hasConnection) return; // profissional ainda não conectou — não é erro

    try {
      const { client, connection } = await this.getAuthorizedClient(appointment.professionalId);
      const calendar = google.calendar({ version: 'v3', auth: client });
      const eventBody = this.toGoogleEvent(appointment);

      let googleEventId = appointment.googleEventId;
      if (googleEventId) {
        await calendar.events.update({
          calendarId: connection.googleCalendarId,
          eventId: googleEventId,
          requestBody: eventBody,
        });
      } else {
        const { data } = await calendar.events.insert({
          calendarId: connection.googleCalendarId,
          requestBody: eventBody,
        });
        googleEventId = data.id ?? null;
        if (googleEventId) {
          await this.prisma.appointment.update({
            where: { id: appointment.id },
            data: { googleEventId },
          });
        }
      }

      await this.prisma.googleCalendarConnection.update({
        where: { userId: appointment.professionalId },
        data: { lastSyncAt: new Date(), lastSyncError: null },
      });
      this.breaker.recordSuccess();
    } catch (err) {
      this.breaker.recordFailure();
      await this.prisma.googleCalendarConnection
        .update({
          where: { userId: appointment.professionalId },
          data: { lastSyncError: (err as Error).message },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  async deleteEventForAppointment(appointmentId: string, googleEventId: string | null): Promise<void> {
    if (!googleEventId) return;

    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) return;
    const hasConnection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: appointment.professionalId },
    });
    if (!hasConnection) return;

    try {
      const { client, connection } = await this.getAuthorizedClient(appointment.professionalId);
      const calendar = google.calendar({ version: 'v3', auth: client });
      await calendar.events.delete({ calendarId: connection.googleCalendarId, eventId: googleEventId });
      this.breaker.recordSuccess();
    } catch (err: any) {
      // 404/410 = já não existe no Google, não é falha real.
      if (err?.code === 404 || err?.code === 410) return;
      this.breaker.recordFailure();
      throw err;
    }
  }

  async registerWatchChannel(professionalId: string): Promise<void> {
    const webhookUrl = this.config.get<string>('GOOGLE_CALENDAR_WEBHOOK_URL');
    if (!webhookUrl || webhookUrl.includes('SEU-DOMINIO-PUBLICO')) {
      this.logger.warn(
        'GOOGLE_CALENDAR_WEBHOOK_URL não configurada com um domínio público — push notifications desativadas (sync incremental via polling manual continua funcionando).',
      );
      return;
    }

    const { client, connection } = await this.getAuthorizedClient(professionalId);
    const calendar = google.calendar({ version: 'v3', auth: client });
    const channelId = randomUUID();

    const { data } = await calendar.events.watch({
      calendarId: connection.googleCalendarId,
      requestBody: { id: channelId, type: 'web_hook', address: webhookUrl },
    });

    await this.prisma.googleCalendarConnection.update({
      where: { userId: professionalId },
      data: {
        channelId,
        resourceId: data.resourceId ?? undefined,
        channelExpiresAt: data.expiration ? new Date(Number(data.expiration)) : undefined,
      },
    });
  }

  /** Chamado pelo webhook quando o Google avisa que algo mudou. */
  async runIncrementalSync(channelId: string): Promise<void> {
    const connection = await this.prisma.googleCalendarConnection.findFirst({ where: { channelId } });
    if (!connection) {
      this.logger.warn(`Webhook recebido para channelId desconhecido: ${channelId}`);
      return;
    }

    const { client } = await this.getAuthorizedClient(connection.userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    const listParams: calendar_v3.Params$Resource$Events$List = {
      calendarId: connection.googleCalendarId,
      syncToken: connection.syncToken ?? undefined,
      singleEvents: true,
    };

    try {
      do {
        const { data } = await calendar.events.list({ ...listParams, pageToken });
        for (const event of data.items ?? []) {
          await this.reconcileIncomingEvent(connection.userId, event);
        }
        pageToken = data.nextPageToken ?? undefined;
        nextSyncToken = data.nextSyncToken ?? nextSyncToken;
      } while (pageToken);

      await this.prisma.googleCalendarConnection.update({
        where: { userId: connection.userId },
        data: { syncToken: nextSyncToken, lastSyncAt: new Date(), lastSyncError: null },
      });
    } catch (err: any) {
      if (err?.code === 410) {
        // syncToken expirado — precisa de full resync (limpa o token, próxima chamada lista tudo).
        await this.prisma.googleCalendarConnection.update({
          where: { userId: connection.userId },
          data: { syncToken: null },
        });
        return;
      }
      await this.prisma.googleCalendarConnection.update({
        where: { userId: connection.userId },
        data: { lastSyncError: (err as Error).message },
      });
      throw err;
    }
  }

  /**
   * Aplica um evento recebido do Google ao estado do CRM.
   * - Evento com crmAppointmentId nas extendedProperties: fomos nós que
   *   criamos; só espelhamos de volta mudanças de horário/cancelamento
   *   feitas manualmente no Google, escrevendo direto via Prisma (nunca via
   *   AppointmentsService) para não reemitir eventos e causar loop.
   * - Evento sem crmAppointmentId: foi criado direto no Google Calendar —
   *   espelhado como ScheduleBlock para não sobrepor disponibilidade.
   */
  private async reconcileIncomingEvent(professionalId: string, event: calendar_v3.Schema$Event) {
    const crmAppointmentId = event.extendedProperties?.private?.crmAppointmentId;

    if (crmAppointmentId) {
      const appointment = await this.prisma.appointment.findUnique({ where: { id: crmAppointmentId } });
      if (!appointment) return;

      if (event.status === 'cancelled') {
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: 'CANCELLED', cancelReason: 'Cancelado diretamente no Google Calendar', source: 'GOOGLE' },
        });
        return;
      }

      const newStart = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      const newEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      if (newStart && newEnd && (newStart.getTime() !== appointment.startAt.getTime() || newEnd.getTime() !== appointment.endAt.getTime())) {
        await this.prisma.appointment.update({
          where: { id: appointment.id },
          data: { startAt: newStart, endAt: newEnd, source: 'GOOGLE' },
        });
      }
      return;
    }

    // Evento externo (criado direto no Google) — espelha como bloqueio.
    if (!event.id) return;
    if (event.status === 'cancelled') {
      await this.prisma.scheduleBlock.deleteMany({ where: { googleEventId: event.id } });
      return;
    }
    if (!event.start?.dateTime || !event.end?.dateTime) return; // ignora eventos de dia inteiro no MVP

    await this.prisma.scheduleBlock.upsert({
      where: { googleEventId: event.id },
      create: {
        professionalId,
        googleEventId: event.id,
        startAt: new Date(event.start.dateTime),
        endAt: new Date(event.end.dateTime),
        type: ScheduleBlockType.OTHER,
        reason: event.summary ?? 'Evento externo do Google Calendar',
      },
      update: {
        startAt: new Date(event.start.dateTime),
        endAt: new Date(event.end.dateTime),
        reason: event.summary ?? 'Evento externo do Google Calendar',
      },
    });
  }

  async health(professionalId: string) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { userId: professionalId },
    });
    if (!connection) return { connected: false };
    return {
      connected: true,
      lastSyncAt: connection.lastSyncAt,
      lastSyncError: connection.lastSyncError,
      channelActive: Boolean(connection.channelId),
    };
  }
}
