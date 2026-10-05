import { useState } from 'react';
import { TasksApi, notifyTasksChanged } from '../api/endpoints';
import type { Task } from '../api/types';

/** Concluir/reabrir e excluir tarefas, com estado de "ocupado" por tarefa e mensagem de erro. */
export function useTaskActions(onChanged: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(task: Task, action: () => Promise<unknown>, fallback: string) {
    setBusyId(task.id);
    setError(null);
    try {
      await action();
      notifyTasksChanged();
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? fallback);
    } finally {
      setBusyId(null);
    }
  }

  return {
    busyId,
    error,
    clearError: () => setError(null),
    toggle: (task: Task) =>
      run(
        task,
        () => (task.status === 'DONE' ? TasksApi.reopen(task.id) : TasksApi.complete(task.id)),
        'Não foi possível atualizar a tarefa.',
      ),
    remove: (task: Task) => {
      if (!window.confirm(`Excluir a tarefa "${task.title}"? Essa ação não pode ser desfeita.`)) return Promise.resolve();
      return run(task, () => TasksApi.remove(task.id), 'Não foi possível excluir a tarefa.');
    },
  };
}
