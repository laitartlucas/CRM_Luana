import { useState } from 'react';
import { Modal } from './Modal';
import { AppointmentsApi } from '../api/endpoints';
import type { Appointment } from '../api/types';

export function AppointmentDetailModal({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [showCancelReason, setShowCancelReason] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const start = new Date(appointment.startAt);
  const canAct = appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED';

  return (
    <Modal title="Agendamento" onClose={onClose}>
      <div>
        <strong>{appointment.client?.name}</strong> — {appointment.client?.phoneE164}
      </div>
      <div>{appointment.service?.name}</div>
      <div>
        {start.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} às{' '}
        {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div>
        <span className={`badge ${appointment.status}`}>{appointment.status}</span>{' '}
        {appointment.location === 'ONLINE' ? '· Online' : '· Presencial'}
      </div>
      {appointment.notes && <div style={{ color: 'var(--color-text-muted)' }}>{appointment.notes}</div>}

      {canAct && (
        <div className="modal-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {appointment.status === 'SCHEDULED' && (
            <button className="btn secondary" disabled={busy} onClick={() => run(() => AppointmentsApi.confirm(appointment.id))}>
              Confirmar
            </button>
          )}
          <button className="btn secondary" disabled={busy} onClick={() => run(() => AppointmentsApi.complete(appointment.id))}>
            Marcar como concluído
          </button>
          <button className="btn secondary" disabled={busy} onClick={() => run(() => AppointmentsApi.noShow(appointment.id))}>
            Marcar no-show
          </button>
          <button className="btn danger" disabled={busy} onClick={() => setShowCancelReason(true)}>
            Cancelar
          </button>
        </div>
      )}

      {showCancelReason && (
        <div className="field">
          Motivo do cancelamento (opcional)
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => run(() => AppointmentsApi.cancel(appointment.id, reason || undefined))}
          >
            Confirmar cancelamento
          </button>
        </div>
      )}

      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        Dica: arraste o agendamento na agenda para remarcar rapidamente.
      </p>
    </Modal>
  );
}
