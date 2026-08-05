export type Role = 'ADMIN' | 'MANAGER' | 'ATTENDANT';

export interface CurrentUser {
  id: string;
  name?: string;
  email: string;
  role: Role;
  timezone: string;
}

export type MessageTemplateKey =
  | 'newLeadOutreach'
  | 'reminder24h'
  | 'reminder3h'
  | 'reminder1h'
  | 'postServiceFollowUp'
  | 'noShowReengagement'
  | 'renewalReminder';

export type MessageTemplates = Record<MessageTemplateKey, string>;

export interface MessageTemplateMeta {
  label: string;
  description: string;
  variables: string[];
  default: string;
}

export interface CustomMessageTemplate {
  id: string;
  label: string;
  text: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string | number;
  active: boolean;
}

// Módulo 1 — Leads
export type FunnelStage = 'LEAD' | 'PIPELINE' | 'CLIENT' | 'LOST';
export type LeadSource =
  | 'REEL'
  | 'CAROUSEL'
  | 'STORY'
  | 'KEYWORD'
  | 'COMMENT'
  | 'REFERRAL'
  | 'CHALLENGE'
  | 'WHATSAPP_GROUP'
  | 'EVENT'
  | 'OTHER';

// Módulo 2 — Pipeline Comercial
export type PipelineStage =
  | 'NEW'
  | 'FIRST_CONTACT'
  | 'CALL_SCHEDULED'
  | 'PRE_CALL'
  | 'POST_CALL'
  | 'PROPOSAL_SENT'
  | 'FOLLOW_UP'
  | 'NOT_SCHEDULED'
  | 'NO_SHOW'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'FUTURE';

// Módulo 3 — Sucesso do Cliente
export type SuccessStage =
  | 'NEW_CLIENT'
  | 'INTAKE_FORM_SENT'
  | 'FIRST_SESSION'
  | 'ONGOING'
  | 'CLOSED'
  | 'TESTIMONIAL'
  | 'RENEWAL'
  | 'REFERRAL';

export interface Client {
  id: string;
  name: string;
  phoneE164: string;
  email?: string | null;
  birthday?: string | null;
  bodyType?: string | null;
  colorPalette?: string | null;
  predominantStyle?: string | null;
  averageBudget?: string | number | null;
  preferredBrands: string[];
  restrictions?: string | null;
  notes?: string | null;
  whatsappConsent: boolean;
  marketingConsent: boolean;
  noShowScore: number;
  createdAt: string;

  // Módulo 1 — Leads
  funnelStage: FunnelStage;
  instagram?: string | null;
  city?: string | null;
  profession?: string | null;
  leadSource?: LeadSource | null;
  leadSourceContentRef?: string | null;
  painPoints?: string | null;
  desires?: string | null;
  objections?: string | null;
  leadNotes?: string | null;
  leadScore?: number;

  // Módulo 2 — Pipeline Comercial
  pipelineStage?: PipelineStage | null;
  pipelineStageEnteredAt?: string | null;
  callDate?: string | null;
  lastContactAt?: string | null;
  nextActionNote?: string | null;
  nextActionAt?: string | null;
  proposalValue?: string | number | null;
  paymentMethod?: string | null;

  // Módulo 3 — Sucesso do Cliente
  successStage?: SuccessStage | null;
  successStageEnteredAt?: string | null;
  intakeFormSubmittedAt?: string | null;
  renewalReminderSentAt?: string | null;
}

export interface FunnelStageEvent {
  id: string;
  clientId: string;
  module: 'PIPELINE' | 'SUCCESS';
  fromStage?: string | null;
  toStage: string;
  changedByUser?: { id: string; name: string } | null;
  reason?: string | null;
  enteredAt: string;
  exitedAt?: string | null;
}

export interface WhatsappMessage {
  id: string;
  direction: 'IN' | 'OUT';
  type: 'TEXT' | 'IMAGE' | 'TEMPLATE' | 'SYSTEM';
  content?: string | null;
  mediaUrl?: string | null;
  status: string;
  createdAt: string;
}

export type PipelineBoard = Record<PipelineStage, Client[]>;
export type SuccessBoard = Record<SuccessStage, Client[]>;

export interface FunnelReport {
  mainPath: { stage: PipelineStage; count: number; conversionFromPrevious: number | null }[];
  sideStages: { stage: PipelineStage; count: number }[];
}

export interface OriginReportEntry {
  leadSource: LeadSource;
  contentRef: string | null;
  leads: number;
  closedWon: number;
  conversionRate: number;
}

export interface PipelineMetrics {
  avgTimePerStageHours: { stage: string; avgHours: number }[];
  averageTicket: number;
  mostUsedPaymentMethod: string | null;
  closedWonCount: number;
}

export interface ImportedRespondiLead {
  name?: string;
  phoneE164?: string;
  instagram?: string;
  city?: string;
  profession?: string;
  painPoints?: string;
  desires?: string;
  objections?: string;
  leadNotes?: string;
}

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentLocation = 'PRESENCIAL' | 'ONLINE';

export interface Appointment {
  id: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  location: AppointmentLocation;
  notes?: string | null;
  cancelReason?: string | null;
  client?: Client;
  service?: Service;
  professional?: { id: string; name: string };
}

export interface ScheduleBlock {
  id: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  type: 'LUNCH' | 'DAY_OFF' | 'HOLIDAY' | 'OTHER';
  reason?: string | null;
}

export interface Professional {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
  active: boolean;
}

export interface DashboardKpis {
  totalAppointments: number;
  confirmationRate: number;
  noShowRate: number;
  occupancyRate: number;
  revenueProjection: number;
  revenueRealized: number;
}

export interface ClientMedia {
  id: string;
  clientId: string;
  storageUrl: string;
  type: 'PHOTO' | 'MOODBOARD' | 'OTHER';
  source: 'WHATSAPP' | 'UPLOAD';
  caption?: string | null;
  createdAt: string;
}
