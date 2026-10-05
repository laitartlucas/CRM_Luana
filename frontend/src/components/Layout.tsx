import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { TASKS_CHANGED_EVENT, TasksApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { isTypingTarget } from '../utils/search';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';

const NAV_ITEMS = [
  { to: '/', label: 'Painel', end: true },
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/tarefas', label: 'Tarefas', badgeKey: 'tasks' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/servicos', label: 'Serviços' },
];

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Quantidade de tarefas do próprio usuário atrasadas ou para hoje (selo no menu). */
function useTasksAttention() {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const refresh = () =>
      TasksApi.summary()
        .then((res) => active && setCount(res.data.attention))
        .catch(() => undefined);
    refresh();
    window.addEventListener(TASKS_CHANGED_EVENT, refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.removeEventListener(TASKS_CHANGED_EVENT, refresh);
      window.clearInterval(interval);
    };
    // Recarrega ao navegar, para o selo não ficar velho.
  }, [location.pathname]);

  return count;
}

export function Layout() {
  const { user, logout } = useAuth();
  const tasksAttention = useTasksAttention();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl/Cmd+K abre a busca de qualquer tela; "/" também, desde que não esteja digitando em um campo.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Luana Laitart" />
          <div>
            <div className="sidebar-brand-name">Luana Laitart</div>
            <div className="sidebar-brand-tag">STUDIO</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
            >
              {({ isActive }) => (
                <>
                  <span className="dot">{isActive ? '◈' : '◇'}</span> {item.label}
                  {item.badgeKey === 'tasks' && tasksAttention > 0 && (
                    <span className="nav-badge" aria-label={`${tasksAttention} tarefa(s) para hoje ou atrasada(s)`}>
                      {tasksAttention}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/configuracoes" className={({ isActive }) => (isActive ? 'sidebar-footer-link active' : 'sidebar-footer-link')}>
            <span className="dot">◇</span> Configurações
          </NavLink>
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials(user?.name ?? user?.email)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">{user?.name ?? user?.email}</div>
              <button className="btn-link" style={{ fontSize: '0.72rem', color: 'var(--sidebar-muted)' }} onClick={() => logout()}>
                Sair
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Buscar (Ctrl+K)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="search-trigger-text">Buscar leads, clientes, tarefas…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <NotificationBell />
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
