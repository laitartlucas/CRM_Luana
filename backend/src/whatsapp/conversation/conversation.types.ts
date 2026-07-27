export enum ConversationStep {
  ONBOARDING_ASK_NAME = 'ONBOARDING_ASK_NAME',
  ONBOARDING_ASK_CONSENT = 'ONBOARDING_ASK_CONSENT',
  MENU = 'MENU',
  SCHEDULE_CHOOSE_SERVICE = 'SCHEDULE_CHOOSE_SERVICE',
  SCHEDULE_CHOOSE_LOCATION = 'SCHEDULE_CHOOSE_LOCATION',
  SCHEDULE_CHOOSE_SLOT = 'SCHEDULE_CHOOSE_SLOT',
  SCHEDULE_CONFIRM = 'SCHEDULE_CONFIRM',
  RESCHEDULE_CHOOSE_APPOINTMENT = 'RESCHEDULE_CHOOSE_APPOINTMENT',
  RESCHEDULE_CHOOSE_SLOT = 'RESCHEDULE_CHOOSE_SLOT',
  RESCHEDULE_CONFIRM = 'RESCHEDULE_CONFIRM',
  CANCEL_CHOOSE_APPOINTMENT = 'CANCEL_CHOOSE_APPOINTMENT',
  CANCEL_ASK_REASON = 'CANCEL_ASK_REASON',
  HUMAN_HANDOFF = 'HUMAN_HANDOFF',
}

export interface ConversationStateData {
  serviceId?: string;
  location?: 'PRESENCIAL' | 'ONLINE';
  professionalId?: string;
  candidateSlots?: string[]; // ISO strings
  candidateAppointmentIds?: string[];
  selectedSlotIso?: string;
  targetAppointmentId?: string;
  pendingName?: string;
}

export interface ConversationState {
  step: ConversationStep;
  data: ConversationStateData;
  updatedAt: string;
}

export const CONTEXT_TIMEOUT_MS = 30 * 60 * 1000;

export function freshState(step: ConversationStep, data: ConversationStateData = {}): ConversationState {
  return { step, data, updatedAt: new Date().toISOString() };
}
