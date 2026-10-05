import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InboxApi } from '../api/endpoints';
import type { AppNotification, NotificationType } from '../api/types';
import { timeAgo } from '../utils/time';

const POLL_MS = 60_000;

const TYPE_LABELS: Record<NotificationType, string> = {
  TASK_DUE: 'Tarefa',
  HUMAN_HANDOFF: 'Atendimento',
  NEW_LEAD: 'Lead',
  APPOINTMENT_BOOKED: 'Agenda',
  APPOINTMENT_CANCELLED: 'Agenda',
};

/** Sino da central de notificações: contador de não lidas, lista, marcar como lida e ir para o assunto. */
export function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const refreshCount = useCallback(() => {
    InboxApi.unreadCount()
      .then((res) => setUnread(res.data.count))
      .catch(() => undefined);
  }, []);

  const loadList = useCallback(() => {
    setLoading(true);
    setError(false);
    InboxApi.list({ limit: 30 })
      .then((res) => setItems(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = window.setInterval(refreshCount, POLL_MS);
    window.addEventListener('focus', refreshCount);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshCount);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    loadList();
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loadList]);

  async function handleOpenItem(item: AppNotification) {
    if (!item.readAt) {
      // Otimista: a lista e o contador já refletem a leitura; se falhar, o próximo refresh corrige.
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((n) => Math.max(0, n - 1));
      InboxApi.markRead(item.id).catch(refreshCount);
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  }

  async function handleMarkAll() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    InboxApi.markAllRead().catch(() => {
      refreshCount();
      loadList();
    });
  }

  return (
    <div className="bell" ref={rootRef}>
      <button
        className="bell-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificações, ${unread} não lida(s)` : 'Notificações'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notificações">
          <div className="bell-panel-header">
            <strong>Notificações</strong>
            <button className="btn-link" onClick={handleMarkAll} disabled={unread === 0}>
              Marcar todas como lidas
            </button>
          </div>

          <div className="bell-list">
            {loading && items.length === 0 && <p className="bell-empty">Carregando…</p>}
            {error && (
              <p className="bell-empty error-text" role="alert">
                Não foi possível carregar.{' '}
                <button className="btn-link" onClick={loadList}>
                  Tentar de novo
                </button>
              </p>
            )}
            {!loading && !error && items.length === 0 && <p className="bell-empty">Nenhuma notificação por enquanto.</p>}

            {items.map((item) => (
              <button key={item.id} className={`bell-item${item.readAt ? '' : ' unread'}`} onClick={() => handleOpenItem(item)}>
                <span className="bell-item-tag">{TYPE_LABELS[item.type]}</span>
                <span className="bell-item-title">{item.title}</span>
                {item.body && <span className="bell-item-body">{item.body}</span>}
                <span className="bell-item-time">{timeAgo(item.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
