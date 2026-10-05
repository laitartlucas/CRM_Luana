import { describe, expect, it } from 'vitest';
import {
  chartPoints,
  MAX_PERIOD_DAYS,
  parseDay,
  periodForPreset,
  periodLabel,
  readPeriod,
  validateCustomPeriod,
  writePeriod,
} from './period';

const now = new Date(2026, 9, 15, 10, 0, 0); // 15/10/2026

describe('periodForPreset', () => {
  it('este mês e mês passado', () => {
    expect(periodForPreset('thisMonth', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodForPreset('lastMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('mês passado em janeiro volta para dezembro do ano anterior', () => {
    expect(periodForPreset('lastMonth', new Date(2026, 0, 10))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('últimos 7 e 30 dias incluem hoje', () => {
    expect(periodForPreset('last7', now)).toEqual({ from: '2026-10-09', to: '2026-10-15' });
    expect(periodForPreset('last30', now)).toEqual({ from: '2026-09-16', to: '2026-10-15' });
  });

  it('este ano vai de 1º de janeiro até hoje', () => {
    expect(periodForPreset('thisYear', now)).toEqual({ from: '2026-01-01', to: '2026-10-15' });
  });
});

describe('parseDay', () => {
  it('aceita datas reais e recusa o resto', () => {
    expect(parseDay('2026-10-05')).not.toBeNull();
    expect(parseDay('2026-02-31')).toBeNull();
    expect(parseDay('05/10/2026')).toBeNull();
    expect(parseDay('')).toBeNull();
  });
});

describe('validateCustomPeriod', () => {
  it('período válido', () => {
    expect(validateCustomPeriod('2026-10-01', '2026-10-31')).toBeNull();
    expect(validateCustomPeriod('2026-10-05', '2026-10-05')).toBeNull();
  });

  it('mensagens claras para datas ausentes, invertidas e longas demais', () => {
    expect(validateCustomPeriod('', '2026-10-31')).toMatch(/data inicial e a final/);
    expect(validateCustomPeriod('2026-10-31', '2026-10-01')).toMatch(/não pode ser depois/);
    expect(validateCustomPeriod('2024-01-01', '2026-10-01')).toMatch(new RegExp(String(MAX_PERIOD_DAYS)));
  });

  it('aceita exatamente o máximo de dias e recusa um a mais', () => {
    expect(validateCustomPeriod('2025-01-01', '2026-02-04')).toBeNull(); // 400 dias, contando os dois extremos
    expect(validateCustomPeriod('2025-01-01', '2026-02-05')).toMatch(/máximo/); // 401
  });
});

describe('readPeriod / writePeriod', () => {
  it('sem parâmetros usa este mês', () => {
    expect(readPeriod(new URLSearchParams(), now)).toEqual({ preset: 'thisMonth', period: { from: '2026-10-01', to: '2026-10-31' } });
  });

  it('lê um atalho e um período personalizado', () => {
    expect(readPeriod(new URLSearchParams('periodo=last7'), now).period).toEqual({ from: '2026-10-09', to: '2026-10-15' });
    expect(readPeriod(new URLSearchParams('de=2026-08-01&ate=2026-08-31'), now)).toEqual({
      preset: 'custom',
      period: { from: '2026-08-01', to: '2026-08-31' },
    });
  });

  it('valores inválidos na URL voltam ao padrão em vez de quebrar', () => {
    for (const query of ['periodo=banana', 'de=2026-10-31&ate=2026-10-01', 'de=lixo&ate=lixo', 'de=2026-10-01', 'periodo=custom']) {
      expect(readPeriod(new URLSearchParams(query), now).preset).toBe('thisMonth');
    }
  });

  it('o padrão não vai para a URL; atalho e personalizado fazem o caminho de ida e volta', () => {
    expect(writePeriod(readPeriod(new URLSearchParams(), now)).toString()).toBe('');

    const last30 = readPeriod(new URLSearchParams('periodo=last30'), now);
    expect(readPeriod(writePeriod(last30), now)).toEqual(last30);

    const custom = { preset: 'custom' as const, period: { from: '2026-08-01', to: '2026-08-31' } };
    expect(writePeriod(custom).toString()).toBe('de=2026-08-01&ate=2026-08-31');
    expect(readPeriod(writePeriod(custom), now)).toEqual(custom);
  });

  it('trocar o período preserva os outros parâmetros e remove os antigos', () => {
    const current = new URLSearchParams('tab=x&periodo=last7');
    const next = writePeriod({ preset: 'custom', period: { from: '2026-08-01', to: '2026-08-31' } }, current);
    expect(next.get('tab')).toBe('x');
    expect(next.get('periodo')).toBeNull();
    expect(next.get('de')).toBe('2026-08-01');
  });
});

describe('periodLabel', () => {
  it('intervalo e dia único', () => {
    expect(periodLabel({ from: '2026-10-01', to: '2026-10-31' })).toBe('01/10/2026 – 31/10/2026');
    expect(periodLabel({ from: '2026-10-05', to: '2026-10-05' })).toBe('05/10/2026');
  });
});

describe('chartPoints', () => {
  const days = (n: number, start = new Date(2026, 9, 1, 12)) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { date, count: 1 };
    });

  it('períodos curtos: um ponto por dia, rotulado dd/MM', () => {
    const points = chartPoints(days(31));
    expect(points).toHaveLength(31);
    expect(points[0]).toEqual({ label: '01/10', agendamentos: 1 });
  });

  it('períodos longos: agrupa por mês, somando os dias', () => {
    const points = chartPoints(days(90, new Date(2026, 0, 1, 12)));
    expect(points.map((p) => p.label)).toEqual(['jan/26', 'fev/26', 'mar/26']);
    expect(points.map((p) => p.agendamentos)).toEqual([31, 28, 31]);
  });

  it('exatamente no limite ainda é diário', () => {
    expect(chartPoints(days(62))).toHaveLength(62);
    expect(chartPoints(days(63)).length).toBeLessThan(63);
  });

  it('sem dados, sem pontos', () => {
    expect(chartPoints([])).toEqual([]);
  });
});
