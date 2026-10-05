import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TASKS_CHANGED_EVENT, TasksApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { isTypingTarget } from '../utils/search';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { LoadingState } from './ui/StateViews';

// Ícones de traço (24×24). Configurações fica no fim da lista: no computador vai para o rodapé do menu,
// no celular entra na faixa de navegação rolável.
const NAV_ITEMS = [
  { to: '/', label: 'Painel', end: true, icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { to: '/leads', label: 'Leads', icon: 'M9 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM2 21c0-4 3-6 7-6s7 2 7 6M17 11h5M19.5 8.5v5' },
  { to: '/pipeline', label: 'Pipeline', icon: 'M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z' },
  { to: '/tarefas', label: 'Tarefas', badgeKey: 'tasks', icon: 'M4 6l2 2 3-3M4 13l2 2 3-3M12 7h8M12 14h8M12 20h8' },
  { to: '/agenda', label: 'Agenda', icon: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4' },
  { to: '/clientes', label: 'Clientes', icon: 'M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z' },
  { to: '/servicos', label: 'Serviços', icon: 'M12 3l3 4H9zM6 9h12l-1 12H7z' },
  {
    to: '/configuracoes',
    label: 'Configurações',
    className: 'nav-settings',
    icon: 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  },
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
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Ao trocar de página, o foco vai para o conteúdo: leitores de tela anunciam a nova tela e quem usa
  // teclado não fica preso no link do menu que acabou de clicar. (Não na carga inicial.)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    contentRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  async function handleLogout() {
    await logout().catch(() => undefined);
    // Saída explícita vai para o login limpo (sem "voltar para a tela anterior").
    navigate('/login', { replace: true });
  }

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
      <a
        className="skip-link"
        href="#conteudo"
        onClick={(e) => {
          e.preventDefault();
          contentRef.current?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      <aside className="sidebar" aria-label="Menu principal">
        <NavLink to="/" className="sidebar-brand" aria-label="Luana Laitart Studio, ir para o Painel">
          <img src="/logo.png" alt="" />
          <div>
            <div className="sidebar-brand-name">Luana Laitart</div>
            <div className="sidebar-brand-tag">STUDIO</div>
          </div>
        </NavLink>
        <nav className="sidebar-nav" aria-label="Seções">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => ['sidebar-link', item.className, isActive ? 'active' : ''].filter(Boolean).join(' ')}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              {item.label}
              {item.badgeKey === 'tasks' && tasksAttention > 0 && (
                <span className="nav-badge" aria-label={`${tasksAttention} tarefa(s) para hoje ou atrasada(s)`}>
                  {tasksAttention}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">{initials(user?.name ?? user?.email)}</div>
            <div className="sidebar-user-text">
              <div className="sidebar-user-name">{user?.name ?? user?.email}</div>
              <button className="sidebar-logout" onClick={handleLogout}>
                Sair
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-keyshortcuts="Control+K">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="search-trigger-text">Buscar leads, clientes, tarefas…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <NotificationBell />
        </header>
        <main className="app-content" id="conteudo" tabIndex={-1} ref={contentRef}>
          {/* As telas são carregadas sob demanda; o menu e a barra superior continuam na tela enquanto isso. */}
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
