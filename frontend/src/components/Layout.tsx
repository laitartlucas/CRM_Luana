import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { TASKS_CHANGED_EVENT, TasksApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

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
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
