import type { AppointmentStatus } from '../../api/types';

/** Rótulo e tom de cada situação de agendamento. Uma situação = uma cor em todas as telas (docs/design/DESIGN.md). */
const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: string }> = {
  SCHEDULED: { label: 'Aguardando', tone: 'tone-warning' },
  CONFIRMED: { label: 'Confirmado', tone: 'tone-success' },
  COMPLETED: { label: 'Concluído', tone: 'tone-success' },
  CANCELLED: { label: 'Cancelado', tone: 'tone-neutral' },
  NO_SHOW: { label: 'No-show', tone: 'tone-danger' },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const info = APPOINTMENT_STATUS[status] ?? { label: status, tone: 'tone-neutral' };
  return <span className={`badge ${info.tone}`}>{info.label}</span>;
}
