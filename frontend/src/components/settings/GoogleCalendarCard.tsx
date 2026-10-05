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
const STALE_SYNC_MS = 30 * 24 * 60 * 60 * 1000;
function isStale(iso: string) {
  return Date.now() - new Date(iso).getTime() > STALE_SYNC_MS;
}

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
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="section-title">Google Agenda</h2>
          <p className="help-text">Importa eventos com o nome de clientes cadastradas e envia para o Google os agendamentos do CRM.</p>
        </div>
        {health?.connected ? (
          <span className="badge tone-success">
            <span className="badge-dot" />
            Conectado
          </span>
        ) : (
          <span className="badge tone-neutral">
            <span className="badge-dot" />
            Não conectado
          </span>
        )}
      </div>
      {health?.connected && health.lastSyncAt && (
        <div className={`alert ${isStale(health.lastSyncAt) ? 'warning' : 'success'}`}>
          <strong>Última sincronização: {new Date(health.lastSyncAt).toLocaleString('pt-BR')}.</strong>
          {isStale(health.lastSyncAt) && <span> Já faz mais de 30 dias; importe de novo para trazer eventos recentes.</span>}
        </div>
      )}
      {health?.lastSyncError && (
        <div className="alert danger" style={{ marginTop: 'var(--space-3)' }}>
          <strong>Último erro: {health.lastSyncError}</strong>
        </div>
      )}

      {!health?.connected && (
        <div className="actions-row">
          <a className="btn" href={CalendarSyncApi.connectUrl()}>
            Conectar Google Agenda
          </a>
        </div>
      )}

      {health?.connected && (
        <>
          <div className="actions-row">
            <button className="btn" onClick={handleImport} disabled={importing}>
              {importing ? 'Importando…' : 'Importar do Google'}
            </button>
            <button className="btn secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exportando…' : 'Exportar para o Google'}
            </button>
            <a className="btn-link" href={CalendarSyncApi.connectUrl()} style={{ padding: '0 0.5rem' }}>
              Reconectar
            </a>
          </div>
          <p className="help-text" style={{ marginTop: 'var(--space-3)' }}>
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
            <div className="alert success" style={{ marginTop: 'var(--space-3)', display: 'block' }}>
              <strong>Importação concluída</strong>
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                <li>{importResult.imported} agendamento(s) importado(s)</li>
                <li>{importResult.skippedNoClient} evento(s) ignorado(s) — sem cliente identificado no título/descrição</li>
                <li>{importResult.skippedExisting} evento(s) já haviam sido importados antes</li>
              </ul>
            </div>
          )}

          {exportResult && (
            <div className="alert success" style={{ marginTop: 'var(--space-3)', display: 'block' }}>
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
