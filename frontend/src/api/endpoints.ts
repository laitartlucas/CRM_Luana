import { api } from './client';
import type {
  Appointment,
  Client,
  ClientMedia,
  CurrentUser,
  CustomMessageTemplate,
  DashboardKpis,
  FunnelReport,
  FunnelStageEvent,
  LeadSource,
  MessageTemplateMeta,
  MessageTemplates,
  OriginReportEntry,
  PipelineBoard,
  PipelineMetrics,
  PipelineStage,
  Professional,
  ScheduleBlock,
  Service,
  SuccessBoard,
  SuccessStage,
  WhatsappMessage,
} from './types';

export const AuthApi = {
  login: (identifier: string, password: string) => api.post<CurrentUser>('/auth/login', { identifier, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<CurrentUser>('/auth/me'),
};

export const ProfessionalsApi = {
  list: () => api.get<Professional[]>('/users/professionals'),
};

export const ClientsApi = {
  list: (search?: string) => api.get<Client[]>('/clients', { params: { search } }),
  get: (id: string) => api.get<Client>(`/clients/${id}`),
  profile: (id: string) =>
    api.get<{ client: Client; appointments: Appointment[]; media: ClientMedia[] }>(`/clients/${id}/profile`),
  create: (data: Partial<Client>) => api.post<Client>('/clients', data),
  update: (id: string, data: Partial<Client>) => api.patch<Client>(`/clients/${id}`, data),
  remove: (id: string) => api.delete(`/clients/${id}`),
  removeAll: (confirmationText: string) => api.delete('/clients', { data: { confirmationText } }),
  uploadMedia: (id: string, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return api.post<ClientMedia>(`/clients/${id}/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const LeadsApi = {
  list: (params: { search?: string; source?: LeadSource } = {}) => api.get<Client[]>('/leads', { params }),
  get: (id: string) => api.get<Client>(`/leads/${id}`),
  profile: (id: string) =>
    api.get<{ lead: Client; stageEvents: FunnelStageEvent[]; appointments: Appointment[]; messages: WhatsappMessage[] }>(
      `/leads/${id}/profile`,
    ),
  create: (data: Partial<Client> & { leadSource: LeadSource }) => api.post<Client>('/leads', data),
  update: (id: string, data: Partial<Client>) => api.patch<Client>(`/leads/${id}`, data),
  remove: (id: string) => api.delete(`/leads/${id}`),
  advanceToPipeline: (id: string, reason?: string) => api.post<Client>(`/leads/${id}/advance-to-pipeline`, { reason }),
};

export const PipelineApi = {
  board: () => api.get<PipelineBoard>('/pipeline/board'),
  changeStage: (id: string, data: { toStage: PipelineStage; callDate?: string; reason?: string }) =>
    api.patch<Client>(`/pipeline/${id}/stage`, data),
  updateCard: (
    id: string,
    data: { nextActionNote?: string; nextActionAt?: string; proposalValue?: number; paymentMethod?: string },
  ) => api.patch<Client>(`/pipeline/${id}`, data),
  funnelReport: (params: { from?: string; to?: string } = {}) => api.get<FunnelReport>('/pipeline/funnel-report', { params }),
  originReport: () => api.get<OriginReportEntry[]>('/pipeline/origin-report'),
  metrics: () => api.get<PipelineMetrics>('/pipeline/metrics'),
};

export const ClientSuccessApi = {
  board: () => api.get<SuccessBoard>('/clients/success-board'),
  changeStage: (id: string, data: { toStage: SuccessStage; reason?: string }) =>
    api.patch<Client>(`/clients/${id}/success-stage`, data),
  intakeLink: (id: string) => api.get<{ url: string }>(`/clients/${id}/intake-link`),
};

export const IntakeApi = {
  getForm: (clientId: string, token: string) =>
    api.get<{
      name: string;
      bodyType: string | null;
      colorPalette: string | null;
      predominantStyle: string | null;
      averageBudget: string | number | null;
      preferredBrands: string[];
      restrictions: string | null;
      alreadySubmitted: boolean;
    }>(`/intake/${clientId}/${token}`),
  submit: (
    clientId: string,
    token: string,
    data: {
      bodyType?: string;
      colorPalette?: string;
      predominantStyle?: string;
      averageBudget?: number;
      preferredBrands?: string[];
      restrictions?: string;
    },
  ) => api.post(`/intake/${clientId}/${token}`, data),
};

export const CatalogApi = {
  list: (includeInactive = false) => api.get<Service[]>('/services', { params: { includeInactive } }),
  create: (data: Partial<Service>) => api.post<Service>('/services', data),
  update: (id: string, data: Partial<Service>) => api.patch<Service>(`/services/${id}`, data),
  deactivate: (id: string) => api.delete(`/services/${id}`),
};

export const AppointmentsApi = {
  list: (params: { professionalId?: string; from?: string; to?: string; clientId?: string }) =>
    api.get<Appointment[]>('/appointments', { params }),
  get: (id: string) => api.get<Appointment>(`/appointments/${id}`),
  create: (data: {
    professionalId: string;
    clientId: string;
    serviceId: string;
    startAt: string;
    location?: string;
    notes?: string;
  }) => api.post<Appointment>('/appointments', data),
  reschedule: (id: string, startAt: string) => api.patch<Appointment>(`/appointments/${id}/reschedule`, { startAt }),
  cancel: (id: string, reason?: string) => api.patch<Appointment>(`/appointments/${id}/cancel`, { reason }),
  confirm: (id: string) => api.patch<Appointment>(`/appointments/${id}/confirm`),
  complete: (id: string) => api.patch<Appointment>(`/appointments/${id}/complete`),
  noShow: (id: string) => api.patch<Appointment>(`/appointments/${id}/no-show`),
  availableSlots: (params: { professionalId: string; serviceId: string; from?: string }) =>
    api.get<string[]>('/appointments/available-slots', { params }),
};

export const ScheduleBlocksApi = {
  list: (professionalId: string, from?: string, to?: string) =>
    api.get<ScheduleBlock[]>('/schedule-blocks', { params: { professionalId, from, to } }),
  create: (data: Partial<ScheduleBlock>) => api.post<ScheduleBlock>('/schedule-blocks', data),
  remove: (id: string) => api.delete(`/schedule-blocks/${id}`),
};

export const DashboardApi = {
  today: (professionalId?: string) => api.get<Appointment[]>('/dashboard/today', { params: { professionalId } }),
  kpis: (params: { professionalId?: string; from?: string; to?: string }) =>
    api.get<DashboardKpis>('/dashboard/kpis', { params }),
};

export const CalendarSyncApi = {
  connectUrl: () => `${(api.defaults.baseURL ?? '')}/calendar-sync/oauth/connect`,
  health: (professionalId: string) =>
    api.get<{ connected: boolean; lastSyncAt?: string; lastSyncError?: string | null }>(
      `/calendar-sync/health/${professionalId}`,
    ),
};

export const WhatsappApi = {
  simulateInbound: (phoneE164: string, text: string) =>
    api.post('/whatsapp/simulate/inbound', { phoneE164, text }),
  evolutionStatus: () => api.get<{ connected: boolean; state: string }>('/whatsapp/evolution/status'),
  evolutionConnect: () => api.post<{ qrCodeBase64: string | null }>('/whatsapp/evolution/connect'),
  send: (clientId: string, text: string) => api.post<{ ok: true }>('/whatsapp/send', { clientId, text }),
};

type MessageTemplatesResponse = {
  templates: MessageTemplates;
  meta: Record<string, MessageTemplateMeta>;
  custom: CustomMessageTemplate[];
};

export const UsersApi = {
  getMessageTemplates: () => api.get<MessageTemplatesResponse>('/users/me/message-templates'),
  updateMessageTemplates: (data: Partial<MessageTemplates>) =>
    api.put<MessageTemplatesResponse>('/users/me/message-templates', data),
  addCustomTemplate: (data: { label: string; text: string }) =>
    api.post<MessageTemplatesResponse>('/users/me/message-templates/custom', data),
  updateCustomTemplate: (id: string, data: { label?: string; text?: string }) =>
    api.patch<MessageTemplatesResponse>(`/users/me/message-templates/custom/${id}`, data),
  removeCustomTemplate: (id: string) =>
    api.delete<MessageTemplatesResponse>(`/users/me/message-templates/custom/${id}`),
};
