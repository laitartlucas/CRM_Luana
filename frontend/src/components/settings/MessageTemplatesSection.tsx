import { useCallback, useEffect, useState } from 'react';
import { UsersApi } from '../../api/endpoints';
import type { CustomMessageTemplate, MessageTemplateKey, MessageTemplateMeta, MessageTemplates } from '../../api/types';
import { useConfirm } from '../ui/ConfirmDialog';
import { ErrorState, LoadingState } from '../ui/StateViews';
import { errorMessage, useToast } from '../ui/Toast';

const TEMPLATE_ORDER: MessageTemplateKey[] = [
  'newLeadOutreach',
  'reminder24h',
  'reminder3h',
  'reminder1h',
  'postServiceFollowUp',
  'noShowReengagement',
  'renewalReminder',
];

const hint = { color: 'var(--color-text-muted)', fontSize: '0.85rem' } as const;
const divider = { borderTop: '1px solid var(--color-border-light)' } as const;

/** Padrões de mensagem do WhatsApp (prontos e personalizados): as duas seções usam a mesma consulta. */
export function MessageTemplatesSection() {
  const toast = useToast();
  const confirm = useConfirm();

  const [meta, setMeta] = useState<Record<string, MessageTemplateMeta> | null>(null);
  const [drafts, setDrafts] = useState<MessageTemplates | null>(null);
  const [custom, setCustom] = useState<CustomMessageTemplate[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [savingKey, setSavingKey] = useState<MessageTemplateKey | null>(null);
  const [savingCustomId, setSavingCustomId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    UsersApi.getMessageTemplates()
      .then((res) => {
        setMeta(res.data.meta);
        setDrafts(res.data.templates);
        setCustom(res.data.custom);
      })
      .catch(() => setLoadError(true));
  }, []);
  useEffect(load, [load]);

  async function saveTemplate(key: MessageTemplateKey, value: string, successMessage: string) {
    setSavingKey(key);
    try {
      const res = await UsersApi.updateMessageTemplates({ [key]: value });
      setDrafts(res.data.templates);
      toast.success(successMessage);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível salvar esse padrão de mensagem. Tente novamente.'));
    } finally {
      setSavingKey(null);
    }
  }

  function updateCustomDraft(id: string, patch: Partial<CustomMessageTemplate>) {
    setCustom((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev));
  }

  async function saveCustom(id: string) {
    const template = custom?.find((t) => t.id === id);
    if (!template) return;
    setSavingCustomId(id);
    try {
      const res = await UsersApi.updateCustomTemplate(id, { label: template.label, text: template.text });
      setCustom(res.data.custom);
      toast.success('Mensagem salva.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível salvar essa mensagem.'));
    } finally {
      setSavingCustomId(null);
    }
  }

  async function deleteCustom(template: CustomMessageTemplate) {
    const ok = await confirm({
      title: `Excluir "${template.label}"?`,
      message: 'A mensagem deixa de aparecer na hora de enviar para uma cliente ou lead.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setSavingCustomId(template.id);
    try {
      const res = await UsersApi.removeCustomTemplate(template.id);
      setCustom(res.data.custom);
      toast.success('Mensagem excluída.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir essa mensagem.'));
    } finally {
      setSavingCustomId(null);
    }
  }

  async function addCustom() {
    if (!newLabel.trim() || !newText.trim()) {
      toast.error('Dê um nome e um texto para a nova mensagem.');
      return;
    }
    setAdding(true);
    try {
      const res = await UsersApi.addCustomTemplate({ label: newLabel.trim(), text: newText.trim() });
      setCustom(res.data.custom);
      setNewLabel('');
      setNewText('');
      toast.success('Mensagem criada.');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível criar essa mensagem.'));
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Padrão de mensagens do WhatsApp</h2>
        <p style={hint}>
          Personalize o texto que a cliente recebe automaticamente em cada situação. Use as variáveis entre chaves duplas —
          elas são substituídas pelos dados reais na hora do envio.
        </p>
        {loadError && <ErrorState message="Não foi possível carregar os padrões de mensagem." onRetry={load} />}
        {!loadError && (!drafts || !meta) && <LoadingState label="Carregando padrões de mensagem…" />}
        {drafts && meta && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            {TEMPLATE_ORDER.map((key) => {
              const info = meta[key];
              if (!info) return null;
              const value = drafts[key] ?? '';
              const isDefault = value.trim() === info.default.trim();
              const busy = savingKey === key;
              return (
                <div key={key} style={{ ...divider, paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>{info.label}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{info.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {info.variables.map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="template-variable"
                          title="Clique para inserir"
                          onClick={() => setDrafts((prev) => (prev ? { ...prev, [key]: `${prev[key] ?? ''}{{${v}}}` } : prev))}
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    aria-label={`Texto: ${info.label}`}
                    value={value}
                    onChange={(e) => setDrafts((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
                    style={{ width: '100%', marginTop: '0.6rem', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn" onClick={() => saveTemplate(key, value, 'Mensagem salva.')} disabled={busy}>
                      {busy ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => saveTemplate(key, '', 'Padrão restaurado.')}
                      disabled={busy || isDefault}
                    >
                      Restaurar padrão
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>Mensagens personalizadas</h2>
        <p style={hint}>
          Crie quantas mensagens quiser, com o nome que preferir — elas aparecem junto com os modelos prontos na hora de
          enviar mensagem para uma cliente ou lead.
        </p>
        {custom && custom.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            {custom.map((t) => (
              <div key={t.id} style={{ ...divider, paddingTop: '1rem' }}>
                <input
                  aria-label="Nome da mensagem"
                  value={t.label}
                  onChange={(e) => updateCustomDraft(t.id, { label: e.target.value })}
                  style={{ fontWeight: 700, marginBottom: '0.5rem', width: '100%', maxWidth: 320 }}
                />
                <textarea
                  rows={3}
                  aria-label={`Texto: ${t.label}`}
                  value={t.text}
                  onChange={(e) => updateCustomDraft(t.id, { text: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button className="btn" disabled={savingCustomId === t.id} onClick={() => saveCustom(t.id)}>
                    {savingCustomId === t.id ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    className="btn secondary"
                    style={{ color: 'var(--color-danger)' }}
                    disabled={savingCustomId === t.id}
                    onClick={() => deleteCustom(t)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ ...divider, paddingTop: '1rem', marginTop: custom?.length ? '1.25rem' : '1rem' }}>
          <div className="form-grid">
            <label className="field">
              Nome da mensagem
              <input placeholder="Ex.: Convite para evento" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </label>
          </div>
          <label className="field" style={{ marginTop: '0.75rem' }}>
            Texto
            <textarea rows={3} placeholder="Escreva o texto da nova mensagem..." value={newText} onChange={(e) => setNewText(e.target.value)} />
          </label>
          <button className="btn" style={{ marginTop: '0.75rem' }} disabled={adding} onClick={addCustom}>
            {adding ? 'Adicionando...' : '+ Nova mensagem'}
          </button>
        </div>
      </div>
    </>
  );
}
