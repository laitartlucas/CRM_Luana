import { Injectable, UnauthorizedException } from '@nestjs/common';
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
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active || !user.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Credenciais inválidas.');
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

  issueTokens(user: { id: string; email: string; role: Role; timezone: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
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
}
