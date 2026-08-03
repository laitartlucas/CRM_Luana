import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CLIENT_SUCCESS_QUEUE, RENEWAL_REMINDER_DAYS_AFTER } from './queue.constants';

@Injectable()
export class ClientSuccessService {
  private readonly logger = new Logger(ClientSuccessService.name);

  constructor(@InjectQueue(CLIENT_SUCCESS_QUEUE) private readonly queue: Queue) {}

  async scheduleRenewalReminder(clientId: string): Promise<void> {
    const delay = RENEWAL_REMINDER_DAYS_AFTER * 24 * 60 * 60 * 1000;
    await this.queue
      .add(
        'renewal-reminder',
        { clientId },
        { jobId: `renewal-reminder-${clientId}`, delay, attempts: 3 },
      )
      .catch((err) => this.logger.warn(`Falha ao agendar lembrete de renovação: ${err.message}`));
  }
}
