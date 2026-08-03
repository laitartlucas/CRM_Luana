import { useState } from 'react';
import { Modal } from './Modal';

export function CallScheduleModal({
  clientName,
  onClose,
  onConfirm,
}: {
  clientName: string;
  onClose: () => void;
  onConfirm: (callDateIso: string) => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!date || !time) {
      setError('Informe data e hora da call.');
      return;
    }
    const iso = new Date(`${date}T${time}:00`).toISOString();
    onConfirm(iso);
  }

  return (
    <Modal title={`Agendar call com ${clientName}`} onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          Hora
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      {error && <span className="error-text">{error}</span>}
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" onClick={handleConfirm}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
