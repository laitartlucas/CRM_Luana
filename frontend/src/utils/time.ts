import { format, isSameDay, subDays } from 'date-fns';

/** "agora", "há 5 min", "há 3 h", "ontem" ou a data — para listas de notificações. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (isSameDay(date, now)) return `há ${Math.floor(minutes / 60)} h`;
  if (isSameDay(date, subDays(now, 1))) return 'ontem';
  return format(date, date.getFullYear() === now.getFullYear() ? 'dd/MM' : 'dd/MM/yyyy');
}
