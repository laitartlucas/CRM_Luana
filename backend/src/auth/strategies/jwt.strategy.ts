import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth.service';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  /**
   * Relê o usuário a cada request: conta desativada, sessão revogada
   * (tokenVersion) ou papel alterado passam a valer na hora, sem esperar o
   * access token de 15 minutos expirar.
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, timezone: true, active: true, tokenVersion: true },
    });
    if (!user || !user.active || (payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Sessão inválida, faça login novamente.');
    }
    return { id: user.id, email: user.email, role: user.role, timezone: user.timezone };
  }
}
