import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

function makeService(opts: { target?: any; otherAdmins?: number } = {}) {
  const target = opts.target ?? { id: 'u1', role: Role.ADMIN, active: true, passwordHash: null };
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(target),
      count: jest.fn().mockResolvedValue(opts.otherAdmins ?? 0),
      update: jest.fn().mockImplementation(async (args: any) => ({ id: 'u1', ...args.data })),
    },
  };
  return { service: new UsersService(prisma), prisma };
}

describe('UsersService — proteção do último administrador', () => {
  it('não permite desativar o único ADMIN ativo', async () => {
    const { service, prisma } = makeService({ otherAdmins: 0 });
    await expect(service.deactivate('u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('não permite rebaixar o único ADMIN ativo', async () => {
    const { service } = makeService({ otherAdmins: 0 });
    await expect(service.update('u1', { role: Role.MANAGER })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite desativar um ADMIN quando existe outro, e revoga as sessões dele', async () => {
    const { service, prisma } = makeService({ otherAdmins: 1 });
    await service.deactivate('u1');
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ active: false, tokenVersion: { increment: 1 } });
  });

  it('mudar o papel revoga as sessões; editar só o nome não', async () => {
    const { service, prisma } = makeService({ target: { id: 'u1', role: Role.MANAGER, active: true }, otherAdmins: 1 });
    await service.update('u1', { role: Role.ATTENDANT });
    expect(prisma.user.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
    await service.update('u1', { name: 'Novo' });
    expect(prisma.user.update.mock.calls[1][0].data.tokenVersion).toBeUndefined();
  });
});

describe('UsersService — senhas', () => {
  it('troca a própria senha só com a atual correta, encerra sessões e zera o bloqueio', async () => {
    const hash = await bcrypt.hash('atual-123', 4);
    const { service, prisma } = makeService({ target: { id: 'u1', role: Role.ADMIN, active: true, passwordHash: hash } });
    await expect(service.changeOwnPassword('u1', 'errada', 'nova-senha-1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();

    await service.changeOwnPassword('u1', 'atual-123', 'nova-senha-1');
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(await bcrypt.compare('nova-senha-1', data.passwordHash)).toBe(true);
    expect(data).toMatchObject({ tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null });
  });

  it('conta sem senha (só Google) não consegue trocar por este caminho', async () => {
    const { service } = makeService({ target: { id: 'u1', role: Role.ATTENDANT, active: true, passwordHash: null } });
    await expect(service.changeOwnPassword('u1', 'x', 'nova-senha-1')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ADMIN redefine a senha de outro usuário', async () => {
    const { service, prisma } = makeService();
    await service.resetPassword('u1', 'outra-senha-1');
    expect(await bcrypt.compare('outra-senha-1', prisma.user.update.mock.calls[0][0].data.passwordHash)).toBe(true);
  });
});
