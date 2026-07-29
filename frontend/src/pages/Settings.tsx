import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarSyncApi, WhatsappApi } from '../api/endpoints';
import { useProfessional } from '../hooks/useProfessional';

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
    const interval = setInterval(loadEvoStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleEvolutionConnect() {
    setEvoLoading(true);
    try {
      const res = await WhatsappApi.evolutionConnect();
      setQrCode(res.data.qrCodeBase64);
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
