import { Link } from 'react-router-dom';
import type { Task } from '../api/types';
import { dueState, formatDue } from '../utils/tasks';
import { PRIORITY_LABELS } from './TaskFormModal';

interface Props {
  task: Task;
  busy?: boolean;
  showClient?: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function clientHref(task: Task) {
  if (!task.client) return null;
  return task.client.funnelStage === 'CLIENT' ? `/clientes/${task.client.id}` : `/leads/${task.client.id}`;
}

export function TaskRow({ task, busy, showClient = true, onToggle, onEdit, onDelete }: Props) {
  const done = task.status === 'DONE';
  const state = done ? 'none' : dueState(task.dueAt);
  const href = showClient ? clientHref(task) : null;

  return (
    <div className={`task-row${done ? ' task-done' : ''}`}>
      <input
        type="checkbox"
        checked={done}
        disabled={busy}
        onChange={() => onToggle(task)}
        aria-label={done ? `Reabrir tarefa: ${task.title}` : `Concluir tarefa: ${task.title}`}
      />
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        <div className="task-meta">
          <span className={`task-due ${state}`}>
            {done && task.completedAt ? `Concluída em ${new Date(task.completedAt).toLocaleDateString('pt-BR')}` : formatDue(task.dueAt)}
          </span>
          {task.priority !== 'NORMAL' && <span className={`task-priority ${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>}
          {href && task.client && <Link to={href}>{task.client.name || '(sem nome)'}</Link>}
          {task.assignee && <span>· {task.assignee.name}</span>}
        </div>
      </div>
      <div className="task-actions">
        <button className="btn-link" onClick={() => onEdit(task)}>
          Editar
        </button>
        <button className="btn-link destructive" onClick={() => onDelete(task)}>
          Excluir
        </button>
      </div>
    </div>
  );
}
