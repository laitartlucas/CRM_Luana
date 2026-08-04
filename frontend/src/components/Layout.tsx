import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Painel', end: true },
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
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

export function Layout() {
  const { user, logout } = useAuth();

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
