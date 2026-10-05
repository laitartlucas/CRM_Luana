import { formatInTimeZone } from 'date-fns-tz';

/** Antecedência do aviso para tarefas com hora marcada. */
export const SOON_MINUTES = 60;
/** Tarefas só com data (gravadas como 23:59) avisam a partir desta hora do dia do prazo. */
export const MORNING_HOUR = 8;
/** Janela de varredura: não avisa sobre tarefas atrasadas há mais do que isso (evita enxurrada ao ligar o recurso). */
export const OVERDUE_LOOKBACK_DAYS = 3;

export type TaskDueKind = 'soon' | 'today' | 'overdue';

/**
 * Decide se (e como) avisar sobre uma tarefa aberta, no fuso de quem vai receber.
 * - Com hora marcada: avisa quando faltar {@link SOON_MINUTES} minutos ou menos, e como atrasada depois do prazo.
 * - Só com data (23:59, ver frontend/src/utils/tasks.ts): avisa de manhã no dia do prazo e como atrasada nos dias seguintes.
 */
export function taskDueNotice(dueAt: Date, timezone: string, now: Date): TaskDueKind | null {
  const isDateOnly = formatInTimeZone(dueAt, timezone, 'HH:mm') === '23:59';

  if (isDateOnly) {
    const dueDay = formatInTimeZone(dueAt, timezone, 'yyyy-MM-dd');
    const today = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
    if (today > dueDay) return 'overdue';
    if (today < dueDay) return null;
    return Number(formatInTimeZone(now, timezone, 'H')) >= MORNING_HOUR ? 'today' : null;
  }

  const minutesLeft = (dueAt.getTime() - now.getTime()) / 60_000;
  if (minutesLeft <= 0) return 'overdue';
  return minutesLeft <= SOON_MINUTES ? 'soon' : null;
}

export const TASK_DUE_TITLES: Record<TaskDueKind, string> = {
  soon: 'Tarefa para daqui a pouco',
  today: 'Tarefa para hoje',
  overdue: 'Tarefa atrasada',
};
