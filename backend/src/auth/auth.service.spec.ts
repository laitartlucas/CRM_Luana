import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

function makeService(user: any) {
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'new', timezone: 'America/Sao_Paulo', ...data })),
      update: jest.fn(),
    },
  };
  const secrets: Record<string, string> = { JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) };
  const config: any = { get: jest.fn((key: string) => secrets[key]) };
  return { service: new AuthService(prisma, new JwtService({}), config), prisma };
}

describe('AuthService.validateUser', () => {
  let hash: string;
  beforeAll(async () => {
    hash = await bcrypt.hash('senha-correta', 4);
  });

  it('aceita nome ou e-mail com a senha correta', async () => {
    const user = { id: '1', name: 'Luana', active: true, passwordHash: hash };
    const { service, prisma } = makeService(user);
    await expect(service.validateUser('luana', 'senha-correta')).resolves.toBe(user);
    expect(prisma.user.findFirst.mock.calls[0][0].where.OR).toEqual([
      { email: 'luana' },
      { name: { equals: 'luana', mode: 'insensitive' } },
    ]);
  });

  it('rejeita senha errada', async () => {
    const { service } = makeService({ id: '1', active: true, passwordHash: hash });
    await expect(service.validateUser('luana', 'senha-errada')).rejects.toThrow(
      new UnauthorizedException('Credenciais inválidas.'),
    );
  });

  it.each([
    ['usuário inexistente', null],
    ['usuário inativo', { id: '1', active: false, passwordHash: 'x' }],
    ['usuário sem senha (só Google)', { id: '1', active: true, passwordHash: null }],
  ])('rejeita %s com a mesma mensagem genérica', async (_label, user) => {
    const { service } = makeService(user);
    await expect(service.validateUser('luana', 'senha-correta')).rejects.toThrow(
      new UnauthorizedException('Credenciais inválidas.'),
    );
  });
});

describe('AuthService tokens', () => {
  it('emite access e refresh com segredos distintos; o refresh só valida com o seu segredo', () => {
    const { service } = makeService(null);
    const tokens = service.issueTokens({ id: 'u1', email: 'a@b.c', role: Role.ADMIN, timezone: 'UTC' });
    expect(service.verifyRefreshToken(tokens.refreshToken)).toMatchObject({ sub: 'u1', role: Role.ADMIN });
    expect(() => service.verifyRefreshToken(tokens.accessToken)).toThrow();
  });
});

describe('AuthService.findOrCreateFromGoogle', () => {
  it('cria novos usuários do Google sempre com o menor papel (ATTENDANT)', async () => {
    const { service, prisma } = makeService(null);
    await service.findOrCreateFromGoogle({ googleId: 'g1', email: 'x@y.z', name: 'X' });
    expect(prisma.user.create.mock.calls[0][0].data.role).toBe(Role.ATTENDANT);
  });
});
