export enum ConversationStep {
  MENU = 'MENU',
  TALK_TO_LUANA_AWAIT_MESSAGE = 'TALK_TO_LUANA_AWAIT_MESSAGE',
  METHOD_AWAIT_ANSWERS = 'METHOD_AWAIT_ANSWERS',
  EXISTING_CLIENT_AWAIT_MESSAGE = 'EXISTING_CLIENT_AWAIT_MESSAGE',
  OTHER_SUBJECT_AWAIT_MESSAGE = 'OTHER_SUBJECT_AWAIT_MESSAGE',
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
