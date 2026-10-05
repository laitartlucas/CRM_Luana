import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function ctx(user: any, roles?: Role[]) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(roles) } as unknown as Reflector;
  const context: any = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return { guard: new RolesGuard(reflector), context };
}

describe('RolesGuard', () => {
  it('sem @Roles libera qualquer usuário autenticado e rotas públicas (sem user)', () => {
    const a = ctx({ role: Role.ATTENDANT }, undefined);
    expect(a.guard.canActivate(a.context)).toBe(true);
    const b = ctx(undefined, []);
    expect(b.guard.canActivate(b.context)).toBe(true);
  });

  it('libera quem tem um dos papéis exigidos', () => {
    const c = ctx({ role: Role.MANAGER }, [Role.ADMIN, Role.MANAGER]);
    expect(c.guard.canActivate(c.context)).toBe(true);
  });

  it('nega papel insuficiente e requisição sem usuário', () => {
    const a = ctx({ role: Role.ATTENDANT }, [Role.ADMIN, Role.MANAGER]);
    expect(() => a.guard.canActivate(a.context)).toThrow(ForbiddenException);
    const b = ctx(undefined, [Role.ADMIN]);
    expect(() => b.guard.canActivate(b.context)).toThrow(ForbiddenException);
  });
});
