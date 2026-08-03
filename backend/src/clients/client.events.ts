/**
 * Emitido pelo ClientsService após uma transição de etapa do Módulo 3
 * (Sucesso do Cliente) já ter sido persistida. Reagido pelo módulo
 * client-success só para o efeito colateral "melhor esforço" (agendar o
 * lembrete de renovação/indicação) — mesmo isolamento de falha usado por
 * appointment.events.ts / pipeline.events.ts.
 */
export const CLIENT_SUCCESS_EVENTS = {
  STAGE_CHANGED: 'clientSuccess.stageChanged',
} as const;

export interface ClientSuccessStageChangedPayload {
  clientId: string;
  fromStage: string | null;
  toStage: string;
}
