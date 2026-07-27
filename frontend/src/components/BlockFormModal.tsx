import { useState } from 'react';
import { Modal } from './Modal';
import { ScheduleBlocksApi } from '../api/endpoints';

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BlockFormModal({
  professionalId,
  initialDate,
  onClose,
  onCreated,
}: {
  professionalId: string;
  initialDate?: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const base = initialDate ?? new Date();
  const [start, setStart] = useState(toLocalInput(base));
  const [end, setEnd] = useState(toLocalInput(new Date(base.getTime() + 60 * 60 * 1000)));
  const [type, setType] = useState<'LUNCH' | 'DAY_OFF' | 'HOLIDAY' | 'OTHER'>('LUNCH');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await ScheduleBlocksApi.create({
        professionalId,
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        type,
        reason: reason || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível criar o bloqueio.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Bloquear horário" onClose={onClose}>
      <label className="field">
        Tipo
        <select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="LUNCH">Almoço</option>
          <option value="DAY_OFF">Folga</option>
          <option value="HOLIDAY">Feriado</option>
          <option value="OTHER">Outro</option>
        </select>
      </label>
      <label className="field">
        Início
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="field">
        Fim
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <label className="field">
        Motivo (opcional)
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && <span className="error-text">{error}</span>}
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Salvando...' : 'Bloquear'}
        </button>
      </div>
    </Modal>
  );
}
