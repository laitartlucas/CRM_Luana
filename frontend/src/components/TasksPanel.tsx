import { useCallback, useEffect, useState } from 'react';
import { TasksApi } from '../api/endpoints';
import type { Task } from '../api/types';
import { useTaskActions } from '../hooks/useTaskActions';
import { TaskFormModal } from './TaskFormModal';
import { TaskRow } from './TaskRow';
import { EmptyState, ErrorState, LoadingState } from './ui/StateViews';

/** Tarefas de uma lead/cliente, para a ficha dela: lista as abertas e as concluídas e permite criar uma nova. */
export function TasksPanel({ client }: { client: { id: string; name: string } }) {
  const [open, setOpen] = useState<Task[]>([]);
  const [done, setDone] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      TasksApi.list({ clientId: client.id, scope: 'open' }),
      TasksApi.list({ clientId: client.id, scope: 'done', limit: 20 }),
    ])
      .then(([o, d]) => {
        setOpen(o.data);
        setDone(d.data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [client.id]);

  useEffect(load, [load]);
  const actions = useTaskActions(load);

  const rowProps = { showClient: false, onToggle: actions.toggle, onEdit: setEditing, onDelete: actions.remove };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h3 style={{ margin: 0 }}>Tarefas</h3>
        <button className="btn secondary" onClick={() => setCreating(true)}>
          + Nova tarefa
        </button>
      </div>

      {actions.error && <ErrorState message={actions.error} />}
      {loadError && <ErrorState message="Não foi possível carregar as tarefas." onRetry={load} />}
      {loading && <LoadingState />}
      {!loading && !loadError && open.length === 0 && <EmptyState>Nenhuma tarefa em aberto.</EmptyState>}

      {open.map((t) => (
        <TaskRow key={t.id} task={t} busy={actions.busyId === t.id} {...rowProps} />
      ))}

      {done.length > 0 && (
        <>
          <button className="btn-link" style={{ marginTop: '0.75rem' }} onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Ocultar' : 'Ver'} concluídas ({done.length})
          </button>
          {showDone && done.map((t) => <TaskRow key={t.id} task={t} busy={actions.busyId === t.id} {...rowProps} />)}
        </>
      )}

      {(creating || editing) && (
        <TaskFormModal
          task={editing ?? undefined}
          client={client}
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
