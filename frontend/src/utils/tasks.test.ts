import { describe, expect, it } from 'vitest';
import { combineDue, dueState, formatDue, splitDue } from './tasks';

// Datas locais (sem "Z"), para o teste não depender do fuso da máquina.
const now = new Date(2026, 9, 5, 15, 0, 0); // 05/10/2026 15:00

describe('combineDue / splitDue', () => {
  it('sem data não há prazo', () => {
    expect(combineDue('', '10:00')).toBeNull();
  });

  it('data sem hora vira fim do dia e volta sem hora no formulário', () => {
    const iso = combineDue('2026-10-10', '')!;
    const back = new Date(iso);
    expect([back.getHours(), back.getMinutes()]).toEqual([23, 59]);
    expect(splitDue(iso)).toEqual({ date: '2026-10-10', time: '' });
  });

  it('data com hora faz o caminho de ida e volta', () => {
    const iso = combineDue('2026-10-10', '14:30')!;
    expect(splitDue(iso)).toEqual({ date: '2026-10-10', time: '14:30' });
  });

  it('valores vazios ou inválidos', () => {
    expect(splitDue(null)).toEqual({ date: '', time: '' });
    expect(combineDue('lixo', '')).toBeNull();
  });
});

describe('dueState', () => {
  it('classifica atrasada, hoje, próxima e sem prazo', () => {
    expect(dueState(new Date(2026, 9, 5, 9, 0).toISOString(), now)).toBe('overdue');
    expect(dueState(new Date(2026, 9, 5, 18, 0).toISOString(), now)).toBe('today');
    expect(dueState(new Date(2026, 9, 6, 9, 0).toISOString(), now)).toBe('upcoming');
    expect(dueState(null, now)).toBe('none');
  });

  it('tarefa de hoje sem hora (23:59) só fica atrasada depois do fim do dia', () => {
    const iso = combineDue('2026-10-05', '')!;
    expect(dueState(iso, now)).toBe('today');
    expect(dueState(iso, new Date(2026, 9, 6, 0, 1))).toBe('overdue');
  });
});

describe('formatDue', () => {
  it('usa Hoje, Amanhã e Ontem, e esconde a hora quando não foi informada', () => {
    expect(formatDue(new Date(2026, 9, 5, 18, 30).toISOString(), now)).toBe('Hoje, 18:30');
    expect(formatDue(combineDue('2026-10-05', ''), now)).toBe('Hoje');
    expect(formatDue(combineDue('2026-10-06', ''), now)).toBe('Amanhã');
    expect(formatDue(combineDue('2026-10-04', ''), now)).toBe('Ontem');
  });

  it('datas distantes em dd/MM, com o ano quando for outro ano', () => {
    expect(formatDue(combineDue('2026-10-20', '09:00'), now)).toBe('20/10, 09:00');
    expect(formatDue(combineDue('2027-01-05', ''), now)).toBe('05/01/2027');
    expect(formatDue(null, now)).toBe('Sem prazo');
  });
});
