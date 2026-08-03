import { useState } from 'react';
import { Modal } from './Modal';
import { LeadsApi } from '../api/endpoints';
import type { LeadSource } from '../api/types';
import { CONTENT_LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_SOURCE_ORDER } from '../constants/pipelineLabels';

export function LeadFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [city, setCity] = useState('');
  const [profession, setProfession] = useState('');
  const [leadSource, setLeadSource] = useState<LeadSource>('REEL');
  const [leadSourceContentRef, setLeadSourceContentRef] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [desires, setDesires] = useState('');
  const [objections, setObjections] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsContentRef = CONTENT_LEAD_SOURCES.includes(leadSource);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await LeadsApi.create({
        name,
        phoneE164: phone,
        instagram: instagram || undefined,
        city: city || undefined,
        profession: profession || undefined,
        leadSource,
        leadSourceContentRef: needsContentRef ? leadSourceContentRef : undefined,
        painPoints: painPoints || undefined,
        desires: desires || undefined,
        objections: objections || undefined,
        leadNotes: leadNotes || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível cadastrar a lead.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Nova lead" onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          WhatsApp (formato internacional)
          <input placeholder="+5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="field">
          Instagram
          <input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </label>
        <label className="field">
          Cidade
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className="field">
          Profissão
          <input value={profession} onChange={(e) => setProfession(e.target.value)} />
        </label>
        <label className="field">
          Origem da lead
          <select value={leadSource} onChange={(e) => setLeadSource(e.target.value as LeadSource)}>
            {LEAD_SOURCE_ORDER.map((source) => (
              <option key={source} value={source}>
                {LEAD_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>
        {needsContentRef && (
          <label className="field">
            Link/descrição do conteúdo
            <input
              placeholder="ex.: Reel sobre guarda-roupa cápsula"
              value={leadSourceContentRef}
              onChange={(e) => setLeadSourceContentRef(e.target.value)}
            />
          </label>
        )}
      </div>

      <h3 style={{ marginBottom: '0.4rem' }}>Relatório da lead</h3>
      <div className="form-grid">
        <label className="field">
          Principais dores
          <textarea rows={2} value={painPoints} onChange={(e) => setPainPoints(e.target.value)} />
        </label>
        <label className="field">
          Desejos
          <textarea rows={2} value={desires} onChange={(e) => setDesires(e.target.value)} />
        </label>
        <label className="field">
          Objeções
          <textarea rows={2} value={objections} onChange={(e) => setObjections(e.target.value)} />
        </label>
        <label className="field">
          Observações gerais
          <textarea rows={2} value={leadNotes} onChange={(e) => setLeadNotes(e.target.value)} />
        </label>
      </div>

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
