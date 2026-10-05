import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function makeStrategy(user: any) {
  const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const config: any = { get: jest.fn().mockReturnValue('s'.repeat(32)) };
  return new JwtStrategy(config, prisma);
}

const payload = { sub: 'u1', email: 'old@x.y', role: 'ADMIN' as const, timezone: 'UTC', tv: 1 };
const dbUser = { id: 'u1', email: 'a@b.c', role: 'ATTENDANT', timezone: 'UTC', active: true, tokenVersion: 1 };

describe('JwtStrategy.validate', () => {
  it('usa papel e e-mail atuais do banco, não os do token', async () => {
    await expect(makeStrategy(dbUser).validate(payload)).resolves.toEqual({
      id: 'u1',
      email: 'a@b.c',
      role: 'ATTENDANT',
      timezone: 'UTC',
    });
  });

  it.each([
    ['usuário removido', null],
    ['usuário desativado', { ...dbUser, active: false }],
    ['sessão revogada (tokenVersion mudou)', { ...dbUser, tokenVersion: 2 }],
  ])('rejeita: %s', async (_label, user) => {
    await expect(makeStrategy(user).validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
