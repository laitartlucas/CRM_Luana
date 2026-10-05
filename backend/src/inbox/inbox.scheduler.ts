import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InboxScanner } from './inbox.scanner';

export const INBOX_QUEUE = 'inbox';
export const INBOX_SCAN_INTERVAL_MS = 2 * 60 * 1000;
const SCAN_JOB = 'scan';

/** Registra a varredura recorrente (idempotente: o jobId fixo evita duplicar a cada reinício). */
@Injectable()
export class InboxScheduler implements OnModuleInit {
  private readonly logger = new Logger(InboxScheduler.name);

  constructor(@InjectQueue(INBOX_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue
      .add(SCAN_JOB, {}, { repeat: { every: INBOX_SCAN_INTERVAL_MS }, jobId: 'inbox-scan', removeOnComplete: true, removeOnFail: 20 })
      .catch((err) => this.logger.warn(`Não foi possível agendar a varredura de avisos: ${err.message}`));
  }
}

@Processor(INBOX_QUEUE)
export class InboxProcessor extends WorkerHost {
  private readonly logger = new Logger(InboxProcessor.name);

  constructor(private readonly scanner: InboxScanner) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SCAN_JOB) {
      this.logger.warn(`Job desconhecido na fila ${INBOX_QUEUE}: ${job.name}`);
      return;
    }
    await this.scanner.run();
  }
}
