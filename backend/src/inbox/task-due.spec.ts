import { MORNING_HOUR, SOON_MINUTES, taskDueNotice } from './task-due';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão

// Hora local de São Paulo -> instante UTC.
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('taskDueNotice — tarefa com hora marcada', () => {
  const dueAt = sp('2026-10-05T15:00:00');

  it('não avisa com mais de 1h de antecedência', () => {
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-05T13:30:00'))).toBeNull();
  });

  it(`avisa "soon" quando faltam ${SOON_MINUTES} minutos ou menos`, () => {
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-05T14:00:00'))).toBe('soon');
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-05T14:59:00'))).toBe('soon');
  });

  it('avisa "overdue" depois do prazo', () => {
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-05T15:00:00'))).toBe('overdue');
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-06T09:00:00'))).toBe('overdue');
  });
});

describe('taskDueNotice — tarefa só com data (23:59)', () => {
  const dueAt = sp('2026-10-05T23:59:00');

  it('não avisa nos dias anteriores nem de madrugada no dia do prazo', () => {
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-04T15:00:00'))).toBeNull();
    expect(taskDueNotice(dueAt, TZ, sp(`2026-10-05T0${MORNING_HOUR - 1}:59:00`))).toBeNull();
  });

  it(`avisa "today" a partir das ${MORNING_HOUR}h do dia do prazo, mesmo às 23h (ainda não venceu)`, () => {
    expect(taskDueNotice(dueAt, TZ, sp(`2026-10-05T0${MORNING_HOUR}:00:00`))).toBe('today');
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-05T23:30:00'))).toBe('today');
  });

  it('avisa "overdue" a partir do dia seguinte', () => {
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-06T00:30:00'))).toBe('overdue');
    expect(taskDueNotice(dueAt, TZ, sp('2026-10-07T10:00:00'))).toBe('overdue');
  });

  it('usa o fuso de quem recebe: 02:00 UTC de 06/10 ainda é 05/10 em São Paulo', () => {
    // 23:59 em São Paulo = 02:59 UTC do dia seguinte.
    expect(taskDueNotice(dueAt, TZ, new Date('2026-10-06T02:00:00Z'))).toBe('today');
    // "Só data" é definido no fuso de quem recebe: em UTC o mesmo instante (02:59) é uma tarefa com hora marcada.
    expect(taskDueNotice(dueAt, 'UTC', new Date('2026-10-06T02:00:00Z'))).toBe('soon');
  });
});
