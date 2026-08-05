import type { LeadSource, PipelineStage, SuccessStage } from '../api/types';

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

export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  'NEW',
  'FIRST_CONTACT',
  'CALL_SCHEDULED',
  'PRE_CALL',
  'POST_CALL',
  'PROPOSAL_SENT',
  'FOLLOW_UP',
  'NOT_SCHEDULED',
  'NO_SHOW',
  'CLOSED_WON',
  'CLOSED_LOST',
  'FUTURE',
];

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

export const SUCCESS_STAGE_ORDER: SuccessStage[] = [
  'NEW_CLIENT',
  'INTAKE_FORM_SENT',
  'FIRST_SESSION',
  'ONGOING',
  'CLOSED',
  'TESTIMONIAL',
  'RENEWAL',
  'REFERRAL',
];

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

export const LEAD_SOURCE_ORDER: LeadSource[] = [
  'REEL',
  'CAROUSEL',
  'STORY',
  'KEYWORD',
  'COMMENT',
  'REFERRAL',
  'CHALLENGE',
  'WHATSAPP_GROUP',
  'EVENT',
  'OTHER',
];

// Origens cujo conteúdo específico (link/descrição) importa cruzar com conversão.
export const CONTENT_LEAD_SOURCES: LeadSource[] = ['REEL', 'CAROUSEL', 'STORY'];
