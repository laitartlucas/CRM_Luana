import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth, startOfYear, subMonths } from 'date-fns';

/** Período de um relatório em datas "AAAA-MM-DD" (é o que a API espera; o fuso é resolvido no servidor). */
export interface Period {
  from: string;
  to: string;
}

export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last7' | 'last30' | 'thisYear' | 'custom';

export const PERIOD_PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'thisMonth', label: 'Este mês' },
  { value: 'lastMonth', label: 'Mês passado' },
  { value: 'last7', label: 'Últimos 7 dias' },
  { value: 'last30', label: 'Últimos 30 dias' },
  { value: 'thisYear', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

export const DEFAULT_PRESET = 'thisMonth' as const satisfies PeriodPreset;
/** Igual ao limite do servidor (MAX_PERIOD_DAYS): um período maior seria recusado com erro 400. */
export const MAX_PERIOD_DAYS = 400;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => format(d, 'yyyy-MM-dd');

/** Datas "AAAA-MM-DD" -> Date local ao meio-dia (evita virar o dia por causa de fuso/horário de verão). */
export function parseDay(value: string): Date | null {
  if (!DATE_ONLY.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export function periodForPreset(preset: Exclude<PeriodPreset, 'custom'>, now: Date = new Date()): Period {
  switch (preset) {
    case 'thisMonth':
      return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
    case 'lastMonth': {
      const previous = subMonths(now, 1);
      return { from: iso(startOfMonth(previous)), to: iso(endOfMonth(previous)) };
    }
    case 'last7':
      return { from: iso(addDays(now, -6)), to: iso(now) };
    case 'last30':
      return { from: iso(addDays(now, -29)), to: iso(now) };
    case 'thisYear':
      return { from: iso(startOfYear(now)), to: iso(now) };
  }
}

/** Mensagem de erro de um período personalizado, ou null se estiver válido. */
export function validateCustomPeriod(from: string, to: string): string | null {
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end) return 'Escolha a data inicial e a final.';
  if (start > end) return 'A data inicial não pode ser depois da final.';
  if (differenceInCalendarDays(end, start) + 1 > MAX_PERIOD_DAYS) return `O período pode ter no máximo ${MAX_PERIOD_DAYS} dias.`;
  return null;
}

export interface PeriodSelection {
  preset: PeriodPreset;
  period: Period;
}

/**
 * Lê o período da URL (?periodo=ultimos-30 ou ?de=...&ate=...). Qualquer valor inválido volta ao
 * padrão (este mês) em vez de quebrar a tela: o link pode ter sido editado à mão.
 */
export function readPeriod(sp: URLSearchParams, now: Date = new Date()): PeriodSelection {
  const from = sp.get('de');
  const to = sp.get('ate');
  if (from && to && validateCustomPeriod(from, to) === null) return { preset: 'custom', period: { from, to } };

  const preset = (sp.get('periodo') ?? DEFAULT_PRESET) as PeriodPreset;
  if (preset !== 'custom' && PERIOD_PRESETS.some((p) => p.value === preset)) {
    return { preset, period: periodForPreset(preset, now) };
  }
  return { preset: DEFAULT_PRESET, period: periodForPreset(DEFAULT_PRESET, now) };
}

/** Parâmetros de URL para uma seleção; o padrão não aparece (URL limpa). */
export function writePeriod(selection: PeriodSelection, sp: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const next = new URLSearchParams(sp);
  next.delete('periodo');
  next.delete('de');
  next.delete('ate');
  if (selection.preset === 'custom') {
    next.set('de', selection.period.from);
    next.set('ate', selection.period.to);
  } else if (selection.preset !== DEFAULT_PRESET) {
    next.set('periodo', selection.preset);
  }
  return next;
}

/** "01/10/2026 – 31/10/2026". */
export function periodLabel(period: Period): string {
  const fmt = (v: string) => {
    const d = parseDay(v);
    return d ? format(d, 'dd/MM/yyyy') : v;
  };
  return period.from === period.to ? fmt(period.from) : `${fmt(period.from)} – ${fmt(period.to)}`;
}

export interface DayCount {
  date: string;
  count: number;
}

/** Acima disto o gráfico agrupa por mês: centenas de barras diárias ficam ilegíveis. */
export const DAILY_CHART_MAX_DAYS = 62;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Pontos do gráfico de agendamentos: por dia (dd/MM) até ~2 meses, depois por mês (mmm/aa). */
export function chartPoints(days: DayCount[]): Array<{ label: string; agendamentos: number }> {
  if (days.length <= DAILY_CHART_MAX_DAYS) {
    return days.map((d) => ({ label: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`, agendamentos: d.count }));
  }
  const byMonth = new Map<string, number>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + d.count);
  }
  return Array.from(byMonth, ([key, agendamentos]) => ({
    label: `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`,
    agendamentos,
  }));
}
