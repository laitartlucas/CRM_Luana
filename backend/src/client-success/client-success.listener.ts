import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CLIENT_SUCCESS_EVENTS, ClientSuccessStageChangedPayload } from '../clients/client.events';
import { ClientSuccessService } from './client-success.service';

@Injectable()
export class ClientSuccessListener {
  constructor(private readonly clientSuccess: ClientSuccessService) {}

  @OnEvent(CLIENT_SUCCESS_EVENTS.STAGE_CHANGED)
  async onStageChanged(payload: ClientSuccessStageChangedPayload) {
    if (payload.toStage !== 'CLOSED') return;
    await this.clientSuccess.scheduleRenewalReminder(payload.clientId);
  }
}
