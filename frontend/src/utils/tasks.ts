import { format, isSameDay, addDays } from 'date-fns';

/**
 * Convenção: tarefa com data mas sem hora é gravada como 23:59 do dia, para
 * continuar em "Hoje" até o fim do dia e só então virar "Atrasada".
 */
export const END_OF_DAY_TIME = '23:59';

/** Junta os inputs de data (YYYY-MM-DD) e hora (HH:mm) — no fuso local — em ISO. Sem data, não há prazo. */
export function combineDue(date: string, time: string): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T${time || END_OF_DAY_TIME}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Inverso de combineDue, para preencher o formulário de edição. */
export function splitDue(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const time = format(d, 'HH:mm');
  return { date: format(d, 'yyyy-MM-dd'), time: time === END_OF_DAY_TIME ? '' : time };
}

export type DueState = 'overdue' | 'today' | 'upcoming' | 'none';

export function dueState(iso: string | null | undefined, now: Date = new Date()): DueState {
  if (!iso) return 'none';
  const due = new Date(iso);
  if (due.getTime() < now.getTime()) return 'overdue';
  return isSameDay(due, now) ? 'today' : 'upcoming';
}

export function formatDue(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'Sem prazo';
  const due = new Date(iso);
  const hasTime = format(due, 'HH:mm') !== END_OF_DAY_TIME;
  const time = hasTime ? `, ${format(due, 'HH:mm')}` : '';
  if (isSameDay(due, now)) return `Hoje${time}`;
  if (isSameDay(due, addDays(now, 1))) return `Amanhã${time}`;
  if (isSameDay(due, addDays(now, -1))) return `Ontem${time}`;
  const sameYear = due.getFullYear() === now.getFullYear();
  return `${format(due, sameYear ? 'dd/MM' : 'dd/MM/yyyy')}${time}`;
}
