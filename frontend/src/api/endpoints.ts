import { api } from './client';
import type {
  Appointment,
  Client,
  ClientMedia,
  CurrentUser,
  DashboardKpis,
  Professional,
  ScheduleBlock,
  Service,
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
  uploadMedia: (id: string, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return api.post<ClientMedia>(`/clients/${id}/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
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
};
