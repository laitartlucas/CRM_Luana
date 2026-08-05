import { useState } from 'react';
import { Modal } from './Modal';
import { LeadsApi } from '../api/endpoints';
import type { LeadSource } from '../api/types';
import { CONTENT_LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_SOURCE_ORDER } from '../constants/pipelineLabels';
import { appendText, hasAnyParsedData, parseRespondiHtml } from '../utils/parseRespondi';

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

  const [respondiUrl, setRespondiUrl] = useState('');
  const [respondiHtml, setRespondiHtml] = useState('');
  const [showHtmlFallback, setShowHtmlFallback] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const needsContentRef = CONTENT_LEAD_SOURCES.includes(leadSource);

  function applyImported(data: {
    name?: string;
    phone?: string;
    instagram?: string;
    city?: string;
    profession?: string;
    painPoints?: string;
    desires?: string;
    objections?: string;
    notes?: string;
  }) {
    if (data.name) setName(data.name);
    if (data.phone) setPhone(data.phone);
    if (data.instagram) setInstagram(data.instagram);
    if (data.city) setCity(data.city);
    if (data.profession) setProfession(data.profession);
    if (data.painPoints) setPainPoints((prev) => appendText(prev, [data.painPoints!]));
    if (data.desires) setDesires((prev) => appendText(prev, [data.desires!]));
    if (data.objections) setObjections((prev) => appendText(prev, [data.objections!]));
    if (data.notes) setLeadNotes((prev) => appendText(prev, [data.notes!]));
    setLeadSource('OTHER');
  }

  async function handleImportRespondiUrl() {
    if (!respondiUrl.trim()) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const res = await LeadsApi.importRespondi(respondiUrl.trim());
      const data = res.data;
      applyImported({
        name: data.name,
        phone: data.phoneE164,
        instagram: data.instagram,
        city: data.city,
        profession: data.profession,
        painPoints: data.painPoints,
        desires: data.desires,
        objections: data.objections,
        notes: data.leadNotes,
      });
      setImportMessage('Dados importados do Respondi — confira os campos abaixo antes de cadastrar.');
    } catch (err: any) {
      setImportMessage(
        err?.response?.data?.message ??
          'Não consegui buscar esse link. Tente colar o HTML manualmente (link abaixo).',
      );
    } finally {
      setImporting(false);
    }
  }

  function handleImportRespondiHtml() {
    if (!respondiHtml.trim()) return;
    const parsed = parseRespondiHtml(respondiHtml);

    if (!hasAnyParsedData(parsed)) {
      setImportMessage('Não encontrei perguntas e respostas nesse HTML. Confira se colou o bloco certo da página.');
      return;
    }

    applyImported({
      name: parsed.name,
      phone: parsed.phone,
      instagram: parsed.instagram,
      city: parsed.city,
      profession: parsed.profession,
      painPoints: parsed.painPoints.join('\n\n') || undefined,
      desires: parsed.desires.join('\n\n') || undefined,
      objections: parsed.objections.join('\n\n') || undefined,
      notes: parsed.notes.join('\n\n') || undefined,
    });
    setImportMessage('Dados importados do Respondi — confira os campos abaixo antes de cadastrar.');
  }

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
      <label className="field" style={{ marginBottom: '0.5rem' }}>
        Importar do Respondi (opcional)
        <input
          placeholder="Cole aqui o link da resposta no Respondi"
          value={respondiUrl}
          onChange={(e) => setRespondiUrl(e.target.value)}
        />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
        <button
          type="button"
          className="btn secondary"
          disabled={!respondiUrl.trim() || importing}
          onClick={handleImportRespondiUrl}
        >
          {importing ? 'Buscando...' : 'Buscar e preencher'}
        </button>
        {importMessage && (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{importMessage}</span>
        )}
      </div>

      <button
        type="button"
        className="btn-link"
        style={{ fontSize: '0.78rem', marginBottom: '1.1rem' }}
        onClick={() => setShowHtmlFallback((v) => !v)}
      >
        {showHtmlFallback ? 'Ocultar alternativa manual' : 'O link não funcionou? Colar o HTML manualmente'}
      </button>

      {showHtmlFallback && (
        <>
          <label className="field" style={{ marginBottom: '0.25rem' }}>
            Colar HTML da resposta
            <textarea
              rows={3}
              placeholder="Na tela da resposta no Respondi: botão direito → Inspecionar → copiar o HTML do bloco de perguntas e colar aqui."
              value={respondiHtml}
              onChange={(e) => setRespondiHtml(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.1rem' }}>
            <button
              type="button"
              className="btn secondary"
              disabled={!respondiHtml.trim()}
              onClick={handleImportRespondiHtml}
            >
              Preencher automaticamente
            </button>
          </div>
        </>
      )}

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
