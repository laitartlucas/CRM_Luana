import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  private setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, this.cookieOptions(15 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, this.cookieOptions(7 * 24 * 60 * 60 * 1000));
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request, @Body() _dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = req.user as any;
    const tokens = this.authService.issueTokens(user);
    this.setSessionCookies(res, tokens);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Sessão expirada, faça login novamente.');
    }
    try {
      const payload = this.authService.verifyRefreshToken(token);
      const tokens = this.authService.issueTokens({
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        timezone: payload.timezone,
      });
      this.setSessionCookies(res, tokens);
      return { ok: true };
    } catch {
      throw new UnauthorizedException('Sessão expirada, faça login novamente.');
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleLogin() {
    // O guard redireciona para a tela de consentimento do Google.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as { googleId: string; email: string; name: string };
    const user = await this.authService.findOrCreateFromGoogle(profile);
    const tokens = this.authService.issueTokens(user);
    this.setSessionCookies(res, tokens);
    res.redirect(this.config.get<string>('WEB_APP_URL') ?? '/');
  }
}
