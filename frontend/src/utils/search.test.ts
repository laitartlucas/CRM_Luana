// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { SearchResults } from '../api/types';
import { flattenResults, isTypingTarget, moveActive } from './search';
import { timeAgo } from './time';

const hit = (id: string) => ({ id, title: id, subtitle: null, href: `/x/${id}` });

describe('flattenResults', () => {
  it('segue a ordem da tela: leads, clientes, agendamentos, tarefas', () => {
    const results: SearchResults = {
      tasks: [hit('t1')],
      clients: [hit('c1'), hit('c2')],
      leads: [hit('l1')],
      appointments: [hit('a1')],
    };
    expect(flattenResults(results).map((f) => `${f.section}:${f.hit.id}`)).toEqual([
      'leads:l1',
      'clients:c1',
      'clients:c2',
      'appointments:a1',
      'tasks:t1',
    ]);
  });

  it('sem resultados devolve lista vazia', () => {
    expect(flattenResults(null)).toEqual([]);
    expect(flattenResults({ leads: [], clients: [], appointments: [], tasks: [] })).toEqual([]);
  });
});

describe('moveActive', () => {
  it('anda para frente e para trás dando a volta nas pontas', () => {
    expect(moveActive(0, 1, 3)).toBe(1);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
  });

  it('lista vazia fica em 0', () => {
    expect(moveActive(0, 1, 0)).toBe(0);
    expect(moveActive(0, -1, 0)).toBe(0);
  });
});

describe('isTypingTarget', () => {
  it('reconhece campos de texto, mas não botões nem o documento', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('timeAgo', () => {
  const now = new Date(2026, 9, 5, 15, 0, 0);
  const at = (d: Date) => d.toISOString();

  it('minutos e horas no mesmo dia', () => {
    expect(timeAgo(at(new Date(2026, 9, 5, 14, 59, 40)), now)).toBe('agora');
    expect(timeAgo(at(new Date(2026, 9, 5, 14, 55, 0)), now)).toBe('há 5 min');
    expect(timeAgo(at(new Date(2026, 9, 5, 11, 30, 0)), now)).toBe('há 3 h');
  });

  it('ontem e datas antigas', () => {
    expect(timeAgo(at(new Date(2026, 9, 4, 23, 0, 0)), now)).toBe('ontem');
    expect(timeAgo(at(new Date(2026, 8, 20, 10, 0, 0)), now)).toBe('20/09');
    expect(timeAgo(at(new Date(2025, 11, 31, 10, 0, 0)), now)).toBe('31/12/2025');
  });
});
