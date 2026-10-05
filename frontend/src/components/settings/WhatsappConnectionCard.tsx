import { useCallback, useEffect, useState } from 'react';
import { WhatsappApi } from '../../api/endpoints';
import { errorMessage } from '../ui/Toast';

// Intervalo mais alto de propósito: checar o status com muita frequência pareceu retroalimentar o
// loop de reconexão da Evolution API durante os testes (a conexão reiniciava sozinha a cada poucos segundos).
const STATUS_POLL_MS = 20_000;

/** Conexão do WhatsApp por QR Code (Evolution API). Só ADMIN/MANAGER — o backend nega os demais. */
export function WhatsappConnectionCard() {
  const [status, setStatus] = useState<{ connected: boolean; state: string } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    WhatsappApi.evolutionStatus()
      .then((res) => {
        setStatus(res.data);
        if (res.data.connected) setQrCode(null);
      })
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [loadStatus]);

  async function handleConnect() {
    if (loading) return; // evita clique duplo disparando reconexões extras na Evolution API
    setLoading(true);
    setError(null);
    try {
      const res = await WhatsappApi.evolutionConnect();
      if (res.data.qrCodeBase64) {
        setQrCode(res.data.qrCodeBase64);
      } else {
        setError('A Evolution API não retornou um QR Code desta vez. Aguarde alguns segundos e tente de novo.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Falha ao conectar com a Evolution API.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="section-title">WhatsApp</h2>
          <p className="help-text">Conecte por QR Code o número que você já usa no celular (via Evolution API), sem migrar para a Meta Cloud API.</p>
        </div>
        {status?.connected ? (
          <span className="badge tone-success">
            <span className="badge-dot" />
            Conectado
          </span>
        ) : (
          <span className="badge tone-danger">
            <span className="badge-dot" />
            Desconectado
          </span>
        )}
      </div>
      {!status?.connected && (
        <>
          <p className="help-text" style={{ color: 'var(--color-text-label)' }}>
            Sem conexão, os lembretes e as mensagens automáticas não são enviados.
          </p>
          <div className="actions-row">
            <button className="btn" onClick={handleConnect} disabled={loading}>
              {loading ? 'Gerando QR Code…' : 'Conectar WhatsApp'}
            </button>
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {qrCode && (
            <div style={{ marginTop: '1rem' }}>
              <img
                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code do WhatsApp"
                style={{ maxWidth: 260, width: '100%' }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho, e escaneie.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
