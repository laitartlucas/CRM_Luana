import { FunnelStage, LeadSource, PipelineStage, SuccessStage } from '@prisma/client';

/**
 * Rótulos em português das planilhas. Espelham frontend/src/constants/pipelineLabels.ts — o front
 * é quem define como as etapas aparecem na tela; se mudar lá, mude aqui para o CSV acompanhar.
 */
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NEW: 'Lead nova',
  FIRST_CONTACT: 'Primeiro contato',
  CALL_SCHEDULED: 'Call agendada',
  PRE_CALL: 'Pré-call',
  POST_CALL: 'Pós-call',
  PROPOSAL_SENT: 'Proposta enviada',
  FOLLOW_UP: 'Follow-up',
  NOT_SCHEDULED: 'Não agendada',
  NO_SHOW: 'Não compareceu',
  CLOSED_WON: 'Fechou',
  CLOSED_LOST: 'Não fechou',
  FUTURE: 'Futuro',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  REEL: 'Reel específico',
  CAROUSEL: 'Carrossel',
  STORY: 'Story',
  KEYWORD: 'Palavra-chave',
  COMMENT: 'Comentário',
  REFERRAL: 'Indicação',
  CHALLENGE: 'Desafio',
  WHATSAPP_GROUP: 'Grupo de WhatsApp',
  EVENT: 'Evento',
  OTHER: 'Outro',
};

export const SUCCESS_STAGE_LABELS: Record<SuccessStage, string> = {
  NEW_CLIENT: 'Cliente nova',
  INTAKE_FORM_SENT: 'Formulário enviado',
  FIRST_SESSION: 'Primeiro encontro',
  ONGOING: 'Acompanhamento',
  CLOSED: 'Encerramento',
  TESTIMONIAL: 'Depoimento',
  RENEWAL: 'Renovação',
  REFERRAL: 'Indicação',
};

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  LEAD: 'Lead nova',
  PIPELINE: 'No Pipeline',
  CLIENT: 'Cliente',
  LOST: 'Perdida',
};

/** Rótulo, ou o próprio valor se surgir uma etapa nova que ainda não foi traduzida aqui. */
export function label<T extends string>(map: Record<T, string>, key: T | null | undefined): string {
  return key ? (map[key] ?? key) : '';
}
