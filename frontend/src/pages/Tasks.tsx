import { useCallback, useEffect, useRef, useState } from 'react';
import { TASKS_CHANGED_EVENT, TasksApi } from '../api/endpoints';
import type { Task, TaskScope, TaskSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskRow } from '../components/TaskRow';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateViews';
import { useTaskActions } from '../hooks/useTaskActions';

type Tab = { scope: TaskScope; label: string; count?: keyof TaskSummary };

const TABS: Tab[] = [
  { scope: 'overdue', label: 'Atrasadas', count: 'overdue' },
  { scope: 'today', label: 'Hoje', count: 'today' },
  { scope: 'upcoming', label: 'Próximas', count: 'upcoming' },
  { scope: 'nodate', label: 'Sem prazo', count: 'nodate' },
  { scope: 'done', label: 'Concluídas' },
];

const EMPTY_TEXT: Record<string, string> = {
  overdue: 'Nenhuma tarefa atrasada. Tudo em dia!',
  today: 'Nada previsto para o resto de hoje.',
  upcoming: 'Nenhuma tarefa agendada para os próximos dias.',
  nodate: 'Nenhuma tarefa sem prazo.',
  done: 'Nenhuma tarefa concluída ainda.',
};

export default function Tasks() {
  const { user } = useAuth();
  const canSeeAll = user?.role !== 'ATTENDANT';
  const [scope, setScope] = useState<TaskScope>('today');
  const [mine, setMine] = useState(true);
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  // Só a resposta da última requisição vale: ao trocar de aba/busca rápido, uma resposta antiga não pode sobrescrever a lista.
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    const requestId = ++latestRequest.current;
    const isLatest = () => requestId === latestRequest.current;
    setLoadError(false);
    TasksApi.list({ scope, search: search.trim() || undefined, assigneeId: mine || !canSeeAll ? 'me' : undefined })
      .then((res) => isLatest() && setTasks(res.data))
      .catch(() => isLatest() && setLoadError(true))
      .finally(() => isLatest() && setLoading(false));
    TasksApi.summary()
      .then((res) => setSummary(res.data))
      .catch(() => undefined);
  }, [scope, search, mine, canSeeAll]);

  useEffect(() => {
    setLoading(true);
    latestRequest.current++; // invalida qualquer resposta ainda em voo do filtro anterior
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  // Outras telas (ficha de lead/cliente) avisam quando mexem em tarefas.
  useEffect(() => {
    window.addEventListener(TASKS_CHANGED_EVENT, load);
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, load);
  }, [load]);

  const actions = useTaskActions(load);

  return (
    <div>
      <div className="toolbar">
        <h1>Tarefas</h1>
        <div className="toolbar-actions">
          <button className="btn" onClick={() => setCreating(true)}>
            + Nova tarefa
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          {TABS.map((tab) => {
            const count = tab.count && summary ? summary[tab.count] : undefined;
            return (
              <button
                key={tab.scope}
                role="tab"
                aria-selected={scope === tab.scope}
                className={`tab${scope === tab.scope ? ' active' : ''}${tab.scope === 'overdue' && count ? ' alert' : ''}`}
                onClick={() => setScope(tab.scope)}
              >
                {tab.label}
                {count !== undefined && count > 0 && <span className="tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="task-tools">
          <input placeholder="Buscar por tarefa ou pessoa..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar tarefas" />
          {canSeeAll && (
            <label className="check-label">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
              Só as minhas
            </label>
          )}
        </div>

        {actions.error && <ErrorState message={actions.error} />}
        {loadError && <ErrorState message="Não foi possível carregar as tarefas." onRetry={load} />}
        {loading && !loadError && <LoadingState />}
        {!loading && !loadError && tasks.length === 0 && (
          <EmptyState>{search.trim() ? 'Nenhuma tarefa encontrada para essa busca.' : EMPTY_TEXT[scope]}</EmptyState>
        )}

        {!loading &&
          tasks.map((t) => (
            <TaskRow key={t.id} task={t} busy={actions.busyId === t.id} onToggle={actions.toggle} onEdit={setEditing} onDelete={actions.remove} />
          ))}
      </div>

      {(creating || editing) && (
        <TaskFormModal
          task={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
