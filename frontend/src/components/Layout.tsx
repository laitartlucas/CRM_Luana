import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Painel', end: true },
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/servicos', label: 'Serviços' },
  { to: '/configuracoes', label: 'Configurações' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-brand">CRM de Estilo</span>
        <nav className="topbar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-user">
          <span>{user?.name ?? user?.email}</span>
          <button className="btn-link" onClick={() => logout()}>
            Sair
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
