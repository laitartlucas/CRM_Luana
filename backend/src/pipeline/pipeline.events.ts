import { Client } from '@prisma/client';

/**
 * Emitido pelo PipelineService após uma transição de etapa já ter sido
 * persistida (client + FunnelStageEvent, na mesma transação). Listeners
 * reagem só a efeitos colaterais "melhor esforço" (criar a call comercial
 * na agenda) — nunca à consistência do próprio funil, que já foi garantida
 * atomicamente pelo service. Mesmo princípio de isolamento de falha de
 * `appointment.events.ts`.
 */
export const PIPELINE_EVENTS = {
  STAGE_CHANGED: 'pipeline.stageChanged',
} as const;

export interface PipelineStageChangedPayload {
  client: Client;
  fromStage: string | null;
  toStage: string;
  changedByUserId?: string;
  reason?: string;
  callDate?: Date;
}
