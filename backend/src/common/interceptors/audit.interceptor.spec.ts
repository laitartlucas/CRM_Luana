import { redactSensitive } from './audit.interceptor';

describe('redactSensitive', () => {
  it('remove hash de senha, googleId e tokens em qualquer nível, preservando o resto', () => {
    const date = new Date('2026-01-01');
    const out = redactSensitive({
      id: '1',
      name: 'Luana',
      passwordHash: '$2b$12$abc',
      googleId: 'g',
      createdAt: date,
      nested: { accessToken: 't', keep: 1 },
      list: [{ refreshToken: 'r', ok: true }],
    });
    expect(out).toEqual({ id: '1', name: 'Luana', createdAt: date, nested: { keep: 1 }, list: [{ ok: true }] });
  });

  it('deixa null e valores simples como estão', () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive('x')).toBe('x');
  });
});
