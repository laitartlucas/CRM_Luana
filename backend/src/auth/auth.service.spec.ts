import { HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService, LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from './auth.service';

function makeService(user: any) {
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'new', timezone: 'America/Sao_Paulo', ...data })),
      update: jest.fn().mockResolvedValue({}),
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
    const user = { id: '1', name: 'Luana', active: true, passwordHash: hash, failedLoginCount: 0, lockedUntil: null };
    const { service, prisma } = makeService(user);
    await expect(service.validateUser('luana', 'senha-correta')).resolves.toBe(user);
    expect(prisma.user.findFirst.mock.calls[0][0].where.OR).toEqual([
      { email: 'luana' },
      { name: { equals: 'luana', mode: 'insensitive' } },
    ]);
  });

  it('rejeita senha errada', async () => {
    const { service } = makeService({ id: '1', active: true, passwordHash: hash, failedLoginCount: 0, lockedUntil: null });
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

describe('AuthService.validateUser — bloqueio por tentativas', () => {
  let hash: string;
  beforeAll(async () => {
    hash = await bcrypt.hash('senha-correta', 4);
  });
  const base = { id: '1', name: 'Luana', active: true, failedLoginCount: 0, lockedUntil: null as Date | null };

  it('conta a falha e ainda não bloqueia antes do limite', async () => {
    const { service, prisma } = makeService({ ...base, passwordHash: hash, failedLoginCount: 1 });
    await expect(service.validateUser('luana', 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { failedLoginCount: 2, lockedUntil: null } });
  });

  it(`bloqueia a conta na falha número ${MAX_FAILED_LOGINS}`, async () => {
    const { service, prisma } = makeService({ ...base, passwordHash: hash, failedLoginCount: MAX_FAILED_LOGINS - 1 });
    await expect(service.validateUser('luana', 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.failedLoginCount).toBe(0);
    const lockMs = data.lockedUntil.getTime() - Date.now();
    expect(lockMs).toBeGreaterThan((LOCKOUT_MINUTES - 1) * 60_000);
    expect(lockMs).toBeLessThanOrEqual(LOCKOUT_MINUTES * 60_000);
  });

  it('recusa com 429 enquanto bloqueada, mesmo com a senha certa, sem checar a senha', async () => {
    const { service, prisma } = makeService({ ...base, passwordHash: hash, lockedUntil: new Date(Date.now() + 5 * 60_000) });
    const err: HttpException = await service.validateUser('luana', 'senha-correta').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('bloqueio vencido deixa entrar e zera o contador', async () => {
    const { service, prisma } = makeService({
      ...base,
      passwordHash: hash,
      failedLoginCount: 3,
      lockedUntil: new Date(Date.now() - 1000),
    });
    await expect(service.validateUser('luana', 'senha-correta')).resolves.toBeDefined();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { failedLoginCount: 0, lockedUntil: null } });
  });

  it('login correto sem falhas anteriores não escreve no banco', async () => {
    const { service, prisma } = makeService({ ...base, passwordHash: hash });
    await service.validateUser('luana', 'senha-correta');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.refreshSession / revogação', () => {
  const dbUser = { id: 'u1', email: 'a@b.c', role: Role.MANAGER, timezone: 'UTC', active: true, tokenVersion: 2 };

  function withUser(user: any) {
    const ctx = makeService(null);
    (ctx.prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    return ctx;
  }
  const tokenFor = (service: AuthService, tokenVersion: number, role: Role = Role.ADMIN) =>
    service.issueTokens({ id: 'u1', email: 'a@b.c', role, timezone: 'UTC', tokenVersion }).refreshToken;

  it('renova usando o papel ATUAL do banco, não o do token antigo', async () => {
    const { service } = withUser(dbUser);
    const tokens = await service.refreshSession(tokenFor(service, 2, Role.ADMIN));
    const payload = service.verifyRefreshToken(tokens.refreshToken);
    expect(payload.role).toBe(Role.MANAGER);
    expect(payload.tv).toBe(2);
  });

  it('recusa token com tokenVersion antigo (sessão revogada)', async () => {
    const { service } = withUser(dbUser);
    await expect(service.refreshSession(tokenFor(service, 1))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa usuário desativado ou removido', async () => {
    const inactive = withUser({ ...dbUser, active: false });
    await expect(inactive.service.refreshSession(tokenFor(inactive.service, 2))).rejects.toBeInstanceOf(UnauthorizedException);
    const missing = withUser(null);
    await expect(missing.service.refreshSession(tokenFor(missing.service, 2))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('recusa token malformado', async () => {
    const { service } = withUser(dbUser);
    await expect(service.refreshSession('lixo')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token antigo sem claim tv vale como versão 0', async () => {
    const { service } = withUser({ ...dbUser, tokenVersion: 0 });
    const legacy = new JwtService({}).sign(
      { sub: 'u1', email: 'a@b.c', role: Role.ADMIN, timezone: 'UTC' },
      { secret: 'b'.repeat(32) },
    );
    await expect(service.refreshSession(legacy)).resolves.toBeDefined();
  });

  it('logout revoga as sessões quando o refresh token é válido e ignora token inválido', async () => {
    const { service, prisma } = makeService(null);
    await service.logout(tokenFor(service, 0));
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { tokenVersion: { increment: 1 } } });
    prisma.user.update.mockClear();
    await service.logout('lixo');
    await service.logout(undefined);
    expect(prisma.user.update).not.toHaveBeenCalled();
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
