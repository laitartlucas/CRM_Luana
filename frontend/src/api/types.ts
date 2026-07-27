export type Role = 'ADMIN' | 'MANAGER' | 'ATTENDANT';

export interface CurrentUser {
  id: string;
  name?: string;
  email: string;
  role: Role;
  timezone: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: string | number;
  active: boolean;
}

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
