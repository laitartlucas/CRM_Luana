import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CalendarSyncService } from './calendar-sync.service';
import { CALENDAR_SYNC_QUEUE } from './queue.constants';

const STATE_COOKIE = 'gcal_oauth_state';

@Controller('calendar-sync')
export class CalendarSyncController {
  constructor(
    private readonly calendarSyncService: CalendarSyncService,
    private readonly config: ConfigService,
    @InjectQueue(CALENDAR_SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  /** Inicia a conexão do Google Calendar do profissional autenticado. */
  @Get('oauth/connect')
  connect(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, JSON.stringify({ state, professionalId: user.id }), {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
      path: '/',
    });
    res.redirect(this.calendarSyncService.buildConsentUrl(state));
  }

  @Public()
  @Get('oauth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const raw = req.cookies?.[STATE_COOKIE];
    if (!raw) {
      throw new BadRequestException('Sessão de autorização expirada, inicie a conexão novamente.');
    }
    const parsed = JSON.parse(raw);
    if (parsed.state !== state) {
      throw new BadRequestException('State inválido — possível tentativa de CSRF.');
    }
    res.clearCookie(STATE_COOKIE, { path: '/' });

    await this.calendarSyncService.handleOAuthCallback(code, parsed.professionalId);
    res.redirect(`${this.config.get<string>('WEB_APP_URL')}/configuracoes?googleCalendar=connected`);
  }

  /** Traz pro CRM os eventos do Google Agenda cujo título/descrição bata com um cliente cadastrado. */
  @Post('import')
  importFromGoogle(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarSyncService.importFromGoogle(user.id);
  }

  /** Envia pro Google Calendar os agendamentos do CRM que ainda não têm espelho lá. */
  @Post('export')
  exportToGoogle(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarSyncService.exportToGoogle(user.id);
  }

  /**
   * Webhook de push notification do Google (ver
   * https://developers.google.com/calendar/api/guides/push). Responde
   * rápido e enfileira o trabalho pesado — nunca faz a chamada de sync
   * dentro da própria request do webhook.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('x-goog-channel-id') channelId: string,
    @Headers('x-goog-resource-state') resourceState: string,
  ) {
    if (channelId && resourceState && resourceState !== 'sync') {
      await this.queue
        .add('incremental-sync', { channelId }, { attempts: 5, backoff: { type: 'exponential', delay: 5000 } })
        .catch(() => undefined);
    }
    return { ok: true };
  }

  @Get('health/:professionalId')
  health(@Param('professionalId') professionalId: string) {
    return this.calendarSyncService.health(professionalId);
  }
}
