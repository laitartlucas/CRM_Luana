import { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Defesa contra CSRF para a sessão por cookie. Em produção os cookies são
 * SameSite=None (front e API em domínios distintos), então o navegador os
 * envia também em requisições disparadas por outros sites. Para métodos que
 * alteram dados, se a requisição traz cookie de sessão E um cabeçalho Origin,
 * o Origin precisa ser o do frontend. Chamadas sem cookie (webhooks de Meta,
 * Evolution, Respondi, Google) e sem Origin (curl, servidor-a-servidor) não
 * são afetadas.
 */
export function csrfOriginMiddleware(allowedWebAppUrl: string | undefined) {
  const allowed = allowedWebAppUrl ? originOf(allowedWebAppUrl) : null;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowed || SAFE_METHODS.has(req.method)) return next();

    const hasSessionCookie = Boolean(req.cookies?.access_token || req.cookies?.refresh_token);
    const origin = req.headers.origin;
    if (!hasSessionCookie || !origin) return next();

    if (originOf(origin) !== allowed) {
      return res.status(403).json({ statusCode: 403, message: 'Origem da requisição não permitida.' });
    }
    return next();
  };
}
