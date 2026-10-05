import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  timezone: string;
  /** tokenVersion do usuário no momento da emissão; tokens antigos (sem `tv`) valem como 0. */
  tv?: number;
}

/** Falhas consecutivas de senha antes de bloquear a conta, e por quanto tempo. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { name: { equals: identifier, mode: 'insensitive' } }],
      },
    });
    if (!user || !user.active || !user.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
      throw new HttpException(
        `Muitas tentativas incorretas. Tente novamente em ${minutes} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      const failures = user.failedLoginCount + 1;
      const lock = failures >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failures,
          lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
        },
      });
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }
    return user;
  }

  async findOrCreateFromGoogle(params: { googleId: string; email: string; name: string }) {
    let user = await this.prisma.user.findUnique({ where: { email: params.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: params.name,
          email: params.email,
          googleId: params.googleId,
          role: Role.ATTENDANT,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: params.googleId },
      });
    }
    return user;
  }

  issueTokens(user: { id: string; email: string; role: Role; timezone: string; tokenVersion?: number }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      tv: user.tokenVersion ?? 0,
    };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
    });
    return { accessToken, refreshToken };
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwt.verify<JwtPayload>(token, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
    });
  }

  /**
   * Renova a sessão relendo o usuário no banco: desativação, troca de papel e
   * revogação (tokenVersion) valem imediatamente, em vez de esperar o refresh
   * token de 7 dias expirar com dados antigos.
   */
  async refreshSession(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Sessão expirada, faça login novamente.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || (payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Sessão expirada, faça login novamente.');
    }
    return this.issueTokens(user);
  }

  /** Invalida todos os tokens já emitidos para o usuário (logout, troca de senha, desativação). */
  async revokeSessions(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }

  /** Logout: se o refresh token ainda for válido, revoga as sessões desse usuário. */
  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    try {
      const payload = this.verifyRefreshToken(refreshToken);
      await this.revokeSessions(payload.sub);
    } catch {
      // Token já expirado/inválido: não há o que revogar, os cookies são limpos de qualquer forma.
    }
  }
}
