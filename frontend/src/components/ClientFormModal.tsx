import { useState } from 'react';
import { Modal } from './Modal';
import { ClientsApi } from '../api/endpoints';

export function ClientFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await ClientsApi.create({ name, phoneE164: phone, email: email || undefined });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível cadastrar a cliente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Nova cliente" onClose={onClose}>
      <label className="field">
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        WhatsApp (formato internacional)
        <input placeholder="+5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="field">
        E-mail (opcional)
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <span className="error-text">{error}</span>}
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Salvando...' : 'Cadastrar'}
        </button>
      </div>
    </Modal>
  );
}
