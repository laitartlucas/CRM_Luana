import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { UsersApi, WhatsappApi } from '../api/endpoints';
import type { CustomMessageTemplate, MessageTemplateKey, MessageTemplateMeta, MessageTemplates } from '../api/types';

const TEMPLATE_ORDER: MessageTemplateKey[] = [
  'newLeadOutreach',
  'reminder24h',
  'reminder3h',
  'reminder1h',
  'postServiceFollowUp',
  'noShowReengagement',
  'renewalReminder',
];

export function SendMessageModal({
  clientId,
  clientName,
  onClose,
  onSent,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [templates, setTemplates] = useState<MessageTemplates | null>(null);
  const [meta, setMeta] = useState<Record<string, MessageTemplateMeta> | null>(null);
  const [custom, setCustom] = useState<CustomMessageTemplate[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    UsersApi.getMessageTemplates()
      .then((res) => {
        setTemplates(res.data.templates);
        setMeta(res.data.meta);
        setCustom(res.data.custom);
      })
      .catch(() => {
        /* modelos são só um atalho — sem eles ainda dá pra escrever mensagem livre */
      });
  }, []);

  function applyTemplate(value: string) {
    if (!value) return;
    let raw = '';
    if (value.startsWith('custom:')) {
      const id = value.slice('custom:'.length);
      raw = custom.find((t) => t.id === id)?.text ?? '';
    } else {
      raw = templates?.[value as MessageTemplateKey] ?? '';
    }
    setText(raw.replace(/\{\{\s*cliente\s*\}\}/g, clientName || 'cliente'));
  }

  async function handleSend() {
    if (!text.trim()) {
      setError('Escreva ou escolha uma mensagem antes de enviar.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await WhatsappApi.send(clientId, text.trim());
      onSent();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={`Enviar mensagem — ${clientName || '(sem nome)'}`} onClose={onClose}>
      {meta && (
        <label className="field">
          Começar a partir de um modelo (opcional)
          <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— mensagem livre —</option>
            {TEMPLATE_ORDER.filter((key) => meta[key]).map((key) => (
              <option key={key} value={key}>
                {meta[key].label}
              </option>
            ))}
            {custom.length > 0 && (
              <optgroup label="Minhas mensagens">
                {custom.map((t) => (
                  <option key={t.id} value={`custom:${t.id}`}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}
      <label className="field">
        Mensagem
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva a mensagem..." />
      </label>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
        Se o modelo tiver variáveis como <code>{'{{servico}}'}</code> ou <code>{'{{data}}'}</code>, ajuste o texto antes
        de enviar — elas só são preenchidas automaticamente nas mensagens agendadas pelo sistema.
      </p>
      {error && <span className="error-text">{error}</span>}
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" disabled={sending} onClick={handleSend}>
          {sending ? 'Enviando...' : 'Enviar mensagem'}
        </button>
      </div>
    </Modal>
  );
}
