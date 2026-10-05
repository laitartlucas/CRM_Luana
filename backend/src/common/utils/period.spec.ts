import { BadRequestException } from '@nestjs/common';
import { MAX_PERIOD_DAYS, resolvePeriod } from './period';

const SP = 'America/Sao_Paulo'; // UTC-3, sem horário de verão

describe('resolvePeriod', () => {
  it('sem datas = sem filtro', () => {
    expect(resolvePeriod({}, SP)).toEqual({});
  });

  it('datas AAAA-MM-DD valem do começo do primeiro dia ao fim do último, no fuso do usuário', () => {
    const { from, to } = resolvePeriod({ from: '2026-10-01', to: '2026-10-31' }, SP);
    expect(from?.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-11-01T02:59:59.999Z');
  });

  it('o mesmo dia em outro fuso dá outro instante', () => {
    const { from } = resolvePeriod({ from: '2026-10-01', to: '2026-10-01' }, 'UTC');
    expect(from?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('um único dia é um período válido (24h)', () => {
    const { from, to } = resolvePeriod({ from: '2026-10-05', to: '2026-10-05' }, SP);
    expect(to!.getTime() - from!.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('aceita instantes ISO completos (compatibilidade com quem já mandava ISO)', () => {
    const { from, to } = resolvePeriod({ from: '2026-10-01T03:00:00.000Z', to: '2026-10-02T03:00:00.000Z' }, SP);
    expect(from?.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(to?.toISOString()).toBe('2026-10-02T03:00:00.000Z');
  });

  it.each([
    ['só o início', { from: '2026-10-01' }],
    ['só o fim', { to: '2026-10-31' }],
    ['texto qualquer', { from: 'ontem', to: 'hoje' }],
    ['dia inexistente', { from: '2026-02-31', to: '2026-03-05' }],
    ['mês inexistente', { from: '2026-13-01', to: '2026-13-05' }],
    ['fim antes do início', { from: '2026-10-31', to: '2026-10-01' }],
    ['período longo demais', { from: '2024-01-01', to: '2026-10-01' }],
  ])('rejeita com 400: %s', (_label, query) => {
    expect(() => resolvePeriod(query, SP)).toThrow(BadRequestException);
  });

  it(`aceita exatamente ${MAX_PERIOD_DAYS} dias e recusa um a mais`, () => {
    expect(() => resolvePeriod({ from: '2025-01-01', to: '2026-02-04' }, 'UTC')).not.toThrow(); // 399 dias
    expect(() => resolvePeriod({ from: '2025-01-01', to: '2026-02-06' }, 'UTC')).toThrow(BadRequestException); // 401
  });
});
