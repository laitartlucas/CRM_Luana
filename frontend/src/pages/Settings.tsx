import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarSyncApi, UsersApi, WhatsappApi } from '../api/endpoints';
import type { MessageTemplateKey, MessageTemplateMeta, MessageTemplates } from '../api/types';
import { useProfessional } from '../hooks/useProfessional';

const TEMPLATE_ORDER: MessageTemplateKey[] = [
  'reminder24h',
  'reminder3h',
  'reminder1h',
  'postServiceFollowUp',
  'noShowReengagement',
  'renewalReminder',
];

export default function Settings() {
  const { professional } = useProfessional();
  const [params] = useSearchParams();
  const [health, setHealth] = useState<{ connected: boolean; lastSyncAt?: string; lastSyncError?: string | null } | null>(
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

  useEffect(() => {
    UsersApi.getMessageTemplates()
      .then((res) => {
        setTemplateMeta(res.data.meta);
        setTemplateDrafts(res.data.templates);
      })
      .catch(() => setTemplateError('Não foi possível carregar os padrões de mensagem.'));
  }, []);

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
    </div>
  );
}
