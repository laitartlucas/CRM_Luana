import { FormEvent, useEffect, useState } from 'react';
import { ProfessionalsApi, TasksApi, notifyTasksChanged } from '../api/endpoints';
import type { Professional, Task, TaskPriority } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { combineDue, splitDue } from '../utils/tasks';
import { Modal } from './Modal';

export const PRIORITY_LABELS: Record<TaskPriority, string> = { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta' };

interface Props {
  /** Se informada, edita a tarefa; senão cria uma nova. */
  task?: Task;
  /** Cria já vinculada a esta lead/cliente (ficha de lead/cliente). */
  client?: { id: string; name: string };
  onClose: () => void;
  onSaved: (task: Task) => void;
}

export function TaskFormModal({ task, client, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const initialDue = splitDue(task?.dueAt);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(initialDue.date);
  const [time, setTime] = useState(initialDue.time);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'NORMAL');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? user?.id ?? '');
  const [people, setPeople] = useState<Professional[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedClient = task?.client ?? client ?? null;

  useEffect(() => {
    ProfessionalsApi.list()
      .then((res) => setPeople(res.data))
      .catch(() => setPeople([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Informe o título da tarefa.');
      return;
    }
    if (time && !date) {
      setError('Escolha a data do prazo (ou apague a hora).');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        dueAt: combineDue(date, time),
        priority,
        assigneeId: assigneeId || undefined,
      };
      const res = task
        ? await TasksApi.update(task.id, payload)
        : await TasksApi.create({ ...payload, clientId: client?.id });
      notifyTasksChanged();
      onSaved(res.data);
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : (message ?? 'Não foi possível salvar a tarefa. Tente novamente.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={task ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.85rem', marginTop: '1rem' }}>
        {linkedClient && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Vinculada a <strong>{linkedClient.name || '(sem nome)'}</strong>
          </div>
        )}
        <label className="field">
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus required placeholder="Ex.: Enviar proposta" />
        </label>
        <label className="field">
          Detalhes (opcional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
        </label>
        <div className="form-grid">
          <label className="field">
            Prazo
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            Hora (opcional)
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
          </label>
          <label className="field">
            Prioridade
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Responsável
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {people.length === 0 && <option value={assigneeId}>{user?.name ?? 'Eu'}</option>}
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.id === user?.id ? ' (eu)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <span className="error-text" role="alert">
            {error}
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
