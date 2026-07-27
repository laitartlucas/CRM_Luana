import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

/**
 * OAuth de LOGIN (identidade). Distinto do OAuth de sincronização de
 * agenda em calendar-sync/ (escopo `calendar`, tokens persistidos por
 * profissional). Aqui só precisamos do e-mail/nome verificados.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_LOGIN_CLIENT_ID') ?? 'not-configured',
      clientSecret: config.get<string>('GOOGLE_LOGIN_CLIENT_SECRET') ?? 'not-configured',
      callbackURL: config.get<string>('GOOGLE_LOGIN_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Conta Google sem e-mail público.'), undefined);
    }
    done(null, {
      googleId: profile.id,
      email,
      name: profile.displayName ?? email,
    });
  }
}
