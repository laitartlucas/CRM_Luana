import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarSyncApi, ClientsApi, UsersApi, WhatsappApi } from '../api/endpoints';
import type { CustomMessageTemplate, MessageTemplateKey, MessageTemplateMeta, MessageTemplates } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useProfessional } from '../hooks/useProfessional';

const WIPE_CONFIRMATION_PHRASE = 'APAGAR TUDO';

const TEMPLATE_ORDER: MessageTemplateKey[] = [
  'newLeadOutreach',
  'reminder24h',
  'reminder3h',
  'reminder1h',
  'postServiceFollowUp',
  'noShowReengagement',
  'renewalReminder',
];

export default function Settings() {
  const { professional } = useProfessional();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [wipeInput, setWipeInput] = useState('');
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeResult, setWipeResult] = useState<string | null>(null);
  const [health, setHealth] = useState<{ connected: boolean; lastSyncAt?: string; lastSyncError?: string | null } | null>(
    null,
  );
  const [gcalImporting, setGcalImporting] = useState(false);
  const [gcalExporting, setGcalExporting] = useState(false);
  const [gcalActionError, setGcalActionError] = useState<string | null>(null);
  const [gcalImportResult, setGcalImportResult] = useState<{
    imported: number;
    skippedNoClient: number;
    skippedExisting: number;
  } | null>(null);
  const [gcalExportResult, setGcalExportResult] = useState<{ exported: number; failed: number; total: number } | null>(
    null,
  );

  const [simPhone, setSimPhone] = useState('+5511999990000');
  const [simText, setSimText] = useState('1');
  const [simLog, setSimLog] = useState<any[]>([]);

  const [evoStatus, setEvoStatus] = useState<{ connected: boolean; state: string } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [evoLoading, setEvoLoading] = useState(false);
  const [evoError, setEvoError] = useState<string | null>(null);

  const [templateMeta, setTemplateMeta] = useState<Record<string, MessageTemplateMeta> | null>(null);
  const [templateDrafts, setTemplateDrafts] = useState<MessageTemplates | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<MessageTemplateKey | null>(null);
  const [templateSavedAt, setTemplateSavedAt] = useState<Record<string, number>>({});
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [customTemplates, setCustomTemplates] = useState<CustomMessageTemplate[] | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [savingCustomId, setSavingCustomId] = useState<string | null>(null);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomText, setNewCustomText] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);

  useEffect(() => {
    UsersApi.getMessageTemplates()
      .then((res) => {
        setTemplateMeta(res.data.meta);
        setTemplateDrafts(res.data.templates);
        setCustomTemplates(res.data.custom);
      })
      .catch(() => setTemplateError('Não foi possível carregar os padrões de mensagem.'));
  }, []);

  function updateCustomDraft(id: string, patch: Partial<CustomMessageTemplate>) {
    setCustomTemplates((prev) => (prev ? prev.map((t) => (t.id === id ? { ...t, ...patch } : t)) : prev));
  }

  async function saveCustomTemplate(id: string) {
    const template = customTemplates?.find((t) => t.id === id);
    if (!template) return;
    setSavingCustomId(id);
    setCustomError(null);
    try {
      const res = await UsersApi.updateCustomTemplate(id, { label: template.label, text: template.text });
      setCustomTemplates(res.data.custom);
    } catch (err: any) {
      setCustomError(err?.response?.data?.message ?? 'Não foi possível salvar essa mensagem.');
    } finally {
      setSavingCustomId(null);
    }
  }

  async function deleteCustomTemplate(id: string) {
    if (!window.confirm('Excluir esta mensagem personalizada?')) return;
    setSavingCustomId(id);
    setCustomError(null);
    try {
      const res = await UsersApi.removeCustomTemplate(id);
      setCustomTemplates(res.data.custom);
    } catch (err: any) {
      setCustomError(err?.response?.data?.message ?? 'Não foi possível excluir essa mensagem.');
    } finally {
      setSavingCustomId(null);
    }
  }

  async function addCustomTemplate() {
    if (!newCustomLabel.trim() || !newCustomText.trim()) {
      setCustomError('Dê um nome e um texto para a nova mensagem.');
      return;
    }
    setAddingCustom(true);
    setCustomError(null);
    try {
      const res = await UsersApi.addCustomTemplate({ label: newCustomLabel.trim(), text: newCustomText.trim() });
      setCustomTemplates(res.data.custom);
      setNewCustomLabel('');
      setNewCustomText('');
    } catch (err: any) {
      setCustomError(err?.response?.data?.message ?? 'Não foi possível criar essa mensagem.');
    } finally {
      setAddingCustom(false);
    }
  }

  async function saveTemplate(key: MessageTemplateKey) {
    if (!templateDrafts) return;
    setSavingTemplate(key);
    setTemplateError(null);
    try {
      const res = await UsersApi.updateMessageTemplates({ [key]: templateDrafts[key] });
      setTemplateDrafts(res.data.templates);
      setTemplateSavedAt((prev) => ({ ...prev, [key]: Date.now() }));
    } catch {
      setTemplateError('Não foi possível salvar esse padrão de mensagem. Tente novamente.');
    } finally {
      setSavingTemplate(null);
    }
  }

  async function restoreTemplateDefault(key: MessageTemplateKey) {
    if (!templateMeta) return;
    setSavingTemplate(key);
    setTemplateError(null);
    try {
      const res = await UsersApi.updateMessageTemplates({ [key]: '' });
      setTemplateDrafts(res.data.templates);
      setTemplateSavedAt((prev) => ({ ...prev, [key]: Date.now() }));
    } catch {
      setTemplateError('Não foi possível restaurar o padrão dessa mensagem. Tente novamente.');
    } finally {
      setSavingTemplate(null);
    }
  }

  function loadHealth() {
    if (!professional) return;
    CalendarSyncApi.health(professional.id).then((res) => setHealth(res.data));
  }

  async function handleGcalImport() {
    setGcalImporting(true);
    setGcalActionError(null);
    setGcalImportResult(null);
    try {
      const res = await CalendarSyncApi.importFromGoogle();
      setGcalImportResult(res.data);
      loadHealth();
    } catch (err: any) {
      setGcalActionError(err?.response?.data?.message ?? 'Não foi possível importar os eventos do Google Agenda.');
    } finally {
      setGcalImporting(false);
    }
  }

  async function handleGcalExport() {
    setGcalExporting(true);
    setGcalActionError(null);
    setGcalExportResult(null);
    try {
      const res = await CalendarSyncApi.exportToGoogle();
      setGcalExportResult(res.data);
      loadHealth();
    } catch (err: any) {
      setGcalActionError(err?.response?.data?.message ?? 'Não foi possível exportar os agendamentos pro Google Agenda.');
    } finally {
      setGcalExporting(false);
    }
  }

  useEffect(loadHealth, [professional]);

  function loadEvoStatus() {
    WhatsappApi.evolutionStatus()
      .then((res) => {
        setEvoStatus(res.data);
        if (res.data.connected) setQrCode(null);
      })
      .catch(() => setEvoStatus(null));
  }

  useEffect(() => {
    loadEvoStatus();
    // Intervalo mais alto de propósito: checar status com muita frequência
    // pareceu retroalimentar o loop de reconexão da Evolution API durante os
    // testes (a conexão reiniciava sozinha a cada poucos segundos).
    const interval = setInterval(loadEvoStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleEvolutionConnect() {
    if (evoLoading) return; // evita clique duplo disparando reconexões extras na Evolution API
    setEvoLoading(true);
    setEvoError(null);
    try {
      const res = await WhatsappApi.evolutionConnect();
      if (res.data.qrCodeBase64) {
        setQrCode(res.data.qrCodeBase64);
      } else {
        setEvoError('A Evolution API não retornou um QR Code desta vez. Aguarde alguns segundos e tente de novo.');
      }
    } catch (err: any) {
      setEvoError(err?.response?.data?.message ?? 'Falha ao conectar com a Evolution API.');
    } finally {
      setEvoLoading(false);
    }
  }

  async function handleSimulate() {
    const res = await WhatsappApi.simulateInbound(simPhone, simText);
    setSimLog((res.data as any)?.messages ?? []);
  }

  async function handleWipeAll() {
    if (wipeInput.trim() !== WIPE_CONFIRMATION_PHRASE) return;
    if (!window.confirm('Última confirmação: isso apaga TODAS as clientes e leads, com agendamentos e conversas. Não tem volta. Continuar?')) {
      return;
    }
    setWiping(true);
    setWipeError(null);
    setWipeResult(null);
    try {
      const res = await ClientsApi.removeAll(wipeInput.trim());
      setWipeResult(`Pronto — ${res.data.deletedClients} registro(s) apagado(s).`);
      setWipeInput('');
    } catch (err: any) {
      setWipeError(err?.response?.data?.message ?? 'Não foi possível apagar os cadastros.');
    } finally {
      setWiping(false);
    }
  }

  return (
    <div>
      <h1>Configurações</h1>

      {params.get('googleCalendar') === 'connected' && (
        <div className="card" style={{ borderColor: 'var(--color-success)', marginBottom: '1rem' }}>
          Google Calendar conectado com sucesso!
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Google Calendar</h3>
        {health?.connected ? (
          <>
            <p>
              Status: <strong style={{ color: 'var(--color-success)' }}>Conectado</strong>
            </p>
            {health.lastSyncAt && <p>Última sincronização: {new Date(health.lastSyncAt).toLocaleString('pt-BR')}</p>}
            {health.lastSyncError && <p className="error-text">Último erro: {health.lastSyncError}</p>}
          </>
        ) : (
          <p>Sua agenda ainda não está conectada ao Google Calendar.</p>
        )}
        <a className="btn" href={CalendarSyncApi.connectUrl()}>
          {health?.connected ? 'Reconectar' : 'Conectar Google Calendar'}
        </a>

        {health?.connected && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn" onClick={handleGcalImport} disabled={gcalImporting}>
                {gcalImporting ? 'Importando...' : 'Importar do Google Agenda'}
              </button>
              <button className="btn" onClick={handleGcalExport} disabled={gcalExporting}>
                {gcalExporting ? 'Exportando...' : 'Exportar pro Google Agenda'}
              </button>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: 0 }}>
              Importar traz eventos dos últimos 3 meses + futuros cujo título ou descrição contenha o nome de um
              cliente já cadastrado (viram agendamentos com o serviço "Importado do Google", editável depois).
              Exportar envia pro Google os agendamentos do CRM que ainda não têm espelho lá.
            </p>

            {gcalActionError && <p className="error-text">{gcalActionError}</p>}

            {gcalImportResult && (
              <div
                className="card"
                style={{ marginTop: '0.5rem', borderColor: 'var(--color-success)', fontSize: '0.85rem' }}
              >
                <strong>Importação concluída</strong>
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                  <li>{gcalImportResult.imported} agendamento(s) importado(s)</li>
                  <li>{gcalImportResult.skippedNoClient} evento(s) ignorado(s) — sem cliente identificado no título/descrição</li>
                  <li>{gcalImportResult.skippedExisting} evento(s) já haviam sido importados antes</li>
                </ul>
              </div>
            )}

            {gcalExportResult && (
              <div
                className="card"
                style={{ marginTop: '0.5rem', borderColor: 'var(--color-success)', fontSize: '0.85rem' }}
              >
                <strong>Exportação concluída</strong>
                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                  <li>{gcalExportResult.exported} de {gcalExportResult.total} agendamento(s) enviado(s) ao Google</li>
                  {gcalExportResult.failed > 0 && <li>{gcalExportResult.failed} falharam — veja o último erro acima em "Status"</li>}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>WhatsApp — conectar por QR Code</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Conecta o número de WhatsApp que você já usa no celular (via Evolution API), sem precisar
          migrar pra Meta Cloud API.
        </p>
        {evoStatus?.connected ? (
          <p>
            Status: <strong style={{ color: 'var(--color-success)' }}>Conectado</strong>
          </p>
        ) : (
          <>
            <p>
              Status: <strong>Desconectado</strong>
            </p>
            <button className="btn" onClick={handleEvolutionConnect} disabled={evoLoading}>
              {evoLoading ? 'Gerando QR Code...' : 'Conectar'}
            </button>
            {evoError && <p className="error-text">{evoError}</p>}
            {qrCode && (
              <div style={{ marginTop: '1rem' }}>
                <img
                  src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code do WhatsApp"
                  style={{ maxWidth: 260 }}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho, e escaneie.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Padrão de mensagens do WhatsApp</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Personalize o texto que a cliente recebe automaticamente em cada situação. Use as variáveis entre chaves
          duplas — elas são substituídas pelos dados reais na hora do envio.
        </p>
        {templateError && <p className="error-text">{templateError}</p>}
        {!templateDrafts || !templateMeta ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Carregando padrões de mensagem...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            {TEMPLATE_ORDER.map((key) => {
              const meta = templateMeta[key];
              if (!meta) return null;
              const value = templateDrafts[key] ?? '';
              const isDefault = value.trim() === meta.default.trim();
              return (
                <div key={key} style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>{meta.label}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{meta.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {meta.variables.map((v) => (
                        <code
                          key={v}
                          style={{
                            fontSize: '0.72rem',
                            background: 'var(--color-border-light)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                          }}
                          title="Clique para inserir"
                          onClick={() =>
                            setTemplateDrafts((prev) => (prev ? { ...prev, [key]: `${prev[key] ?? ''}{{${v}}}` } : prev))
                          }
                        >
                          {`{{${v}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={value}
                    onChange={(e) =>
                      setTemplateDrafts((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))
                    }
                    style={{ width: '100%', marginTop: '0.6rem', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button className="btn" onClick={() => saveTemplate(key)} disabled={savingTemplate === key}>
                      {savingTemplate === key ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => restoreTemplateDefault(key)}
                      disabled={savingTemplate === key || isDefault}
                    >
                      Restaurar padrão
                    </button>
                    {templateSavedAt[key] && Date.now() - templateSavedAt[key] < 4000 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>Salvo!</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Mensagens personalizadas</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Crie quantas mensagens quiser, com o nome que preferir — elas aparecem junto com os modelos prontos na hora
          de enviar mensagem para uma cliente ou lead.
        </p>
        {customError && <p className="error-text">{customError}</p>}
        {customTemplates && customTemplates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            {customTemplates.map((t) => (
              <div key={t.id} style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
                <input
                  value={t.label}
                  onChange={(e) => updateCustomDraft(t.id, { label: e.target.value })}
                  style={{ fontWeight: 700, marginBottom: '0.5rem', width: '100%', maxWidth: 320 }}
                />
                <textarea
                  rows={3}
                  value={t.text}
                  onChange={(e) => updateCustomDraft(t.id, { text: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button className="btn" disabled={savingCustomId === t.id} onClick={() => saveCustomTemplate(t.id)}>
                    {savingCustomId === t.id ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    className="btn secondary"
                    style={{ color: 'var(--color-danger)' }}
                    disabled={savingCustomId === t.id}
                    onClick={() => deleteCustomTemplate(t.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: customTemplates?.length ? '1.25rem' : '1rem' }}>
          <div className="form-grid">
            <label className="field">
              Nome da mensagem
              <input
                placeholder="Ex.: Convite para evento"
                value={newCustomLabel}
                onChange={(e) => setNewCustomLabel(e.target.value)}
              />
            </label>
          </div>
          <label className="field" style={{ marginTop: '0.75rem' }}>
            Texto
            <textarea
              rows={3}
              placeholder="Escreva o texto da nova mensagem..."
              value={newCustomText}
              onChange={(e) => setNewCustomText(e.target.value)}
            />
          </label>
          <button className="btn" style={{ marginTop: '0.75rem' }} disabled={addingCustom} onClick={addCustomTemplate}>
            {addingCustom ? 'Adicionando...' : '+ Nova mensagem'}
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>WhatsApp — simulador de conversa</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Enquanto a conta Meta Business não está aprovada, use este simulador para testar o fluxo de
          agendar/remarcar/cancelar do jeito que uma cliente veria no WhatsApp de verdade (ver{' '}
          <code>WHATSAPP_PROVIDER=mock</code> no backend).
        </p>
        <div className="form-grid">
          <label className="field">
            Telefone simulado
            <input value={simPhone} onChange={(e) => setSimPhone(e.target.value)} />
          </label>
          <label className="field">
            Mensagem
            <input value={simText} onChange={(e) => setSimText(e.target.value)} />
          </label>
        </div>
        <button className="btn" style={{ marginTop: '0.75rem' }} onClick={handleSimulate}>
          Enviar mensagem simulada
        </button>
        <div style={{ marginTop: '1rem' }}>
          {simLog
            .slice()
            .reverse()
            .map((m: any) => (
              <div key={m.id} className="appointment-row">
                <span>{m.direction === 'IN' ? '👤' : '🤖'} {m.content}</span>
              </div>
            ))}
        </div>
      </div>

      {user?.role === 'ADMIN' && (
        <div className="card" style={{ marginTop: '1.25rem', borderColor: 'var(--color-danger)' }}>
          <h3 style={{ marginTop: 0, color: 'var(--color-danger)' }}>Zona de risco</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Apaga permanentemente TODAS as clientes e leads cadastradas, junto com agendamentos, conversas e mensagens
            ligados a elas. Não existe "desfazer". Para confirmar, digite <strong>{WIPE_CONFIRMATION_PHRASE}</strong>{' '}
            abaixo.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={wipeInput}
              onChange={(e) => setWipeInput(e.target.value)}
              placeholder={WIPE_CONFIRMATION_PHRASE}
              style={{ maxWidth: 220 }}
            />
            <button
              className="btn danger"
              disabled={wiping || wipeInput.trim() !== WIPE_CONFIRMATION_PHRASE}
              onClick={handleWipeAll}
            >
              {wiping ? 'Apagando...' : 'Apagar todos os clientes e leads'}
            </button>
          </div>
          {wipeError && <p className="error-text">{wipeError}</p>}
          {wipeResult && <p style={{ color: 'var(--color-success)' }}>{wipeResult}</p>}
        </div>
      )}
    </div>
  );
}
