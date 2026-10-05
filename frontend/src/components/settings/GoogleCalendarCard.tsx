import { useCallback, useEffect, useState } from 'react';
import { CalendarSyncApi } from '../../api/endpoints';
import { errorMessage } from '../ui/Toast';

interface Health {
  connected: boolean;
  lastSyncAt?: string;
  lastSyncError?: string | null;
}

/**
 * Conexão com o Google Calendar. Usa o usuário logado (não "a primeira profissional"):
 * a conexão fica vinculada a quem autenticou no OAuth (calendar-sync.controller.ts usa @CurrentUser()),
 * então o status exibido precisa checar essa mesma identidade.
 */
export function GoogleCalendarCard({ userId }: { userId: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skippedNoClient: number; skippedExisting: number } | null>(null);
  const [exportResult, setExportResult] = useState<{ exported: number; failed: number; total: number } | null>(null);

  const loadHealth = useCallback(() => {
    CalendarSyncApi.health(userId)
      .then((res) => setHealth(res.data))
      .catch(() => setHealth(null));
  }, [userId]);

  useEffect(loadHealth, [loadHealth]);

  async function handleImport() {
    setImporting(true);
    setActionError(null);
    setImportResult(null);
    try {
      const res = await CalendarSyncApi.importFromGoogle();
      setImportResult(res.data);
      loadHealth();
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível importar os eventos do Google Agenda.'));
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setActionError(null);
    setExportResult(null);
    try {
      const res = await CalendarSyncApi.exportToGoogle();
      setExportResult(res.data);
      loadHealth();
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível exportar os agendamentos pro Google Agenda.'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>Google Calendar</h2>
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
            <button className="btn" onClick={handleImport} disabled={importing}>
              {importing ? 'Importando...' : 'Importar do Google Agenda'}
            </button>
            <button className="btn" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exportando...' : 'Exportar pro Google Agenda'}
            </button>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: 0 }}>
            Importar traz eventos dos últimos 3 meses + futuros cujo título ou descrição contenha o nome de um cliente já
            cadastrado (viram agendamentos com o serviço "Importado do Google", editável depois). Exportar envia pro Google
            os agendamentos do CRM que ainda não têm espelho lá.
          </p>

          {actionError && (
            <p className="error-text" role="alert">
              {actionError}
            </p>
          )}

          {importResult && (
            <div className="card" style={{ marginTop: '0.5rem', borderColor: 'var(--color-success)', fontSize: '0.85rem' }}>
              <strong>Importação concluída</strong>
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                <li>{importResult.imported} agendamento(s) importado(s)</li>
                <li>{importResult.skippedNoClient} evento(s) ignorado(s) — sem cliente identificado no título/descrição</li>
                <li>{importResult.skippedExisting} evento(s) já haviam sido importados antes</li>
              </ul>
            </div>
          )}

          {exportResult && (
            <div className="card" style={{ marginTop: '0.5rem', borderColor: 'var(--color-success)', fontSize: '0.85rem' }}>
              <strong>Exportação concluída</strong>
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                <li>
                  {exportResult.exported} de {exportResult.total} agendamento(s) enviado(s) ao Google
                </li>
                {exportResult.failed > 0 && <li>{exportResult.failed} falharam — veja o último erro acima em "Status"</li>}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
