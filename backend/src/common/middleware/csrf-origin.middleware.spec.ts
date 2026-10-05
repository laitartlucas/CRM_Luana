import { csrfOriginMiddleware } from './csrf-origin.middleware';

function run(opts: { allowed?: string; method?: string; origin?: string; cookies?: Record<string, string> }) {
  const mw = csrfOriginMiddleware(opts.allowed ?? 'https://app.exemplo.com/');
  const req: any = { method: opts.method ?? 'POST', headers: opts.origin ? { origin: opts.origin } : {}, cookies: opts.cookies ?? {} };
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  mw(req, res, next);
  return { res, next };
}

const session = { access_token: 'x' };

describe('csrfOriginMiddleware', () => {
  it('bloqueia escrita com cookie de sessão vindo de outra origem', () => {
    const { res, next } = run({ origin: 'https://evil.com', cookies: session });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('bloqueia também quando só há o refresh token', () => {
    const { res } = run({ method: 'DELETE', origin: 'https://evil.com', cookies: { refresh_token: 'x' } });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('permite a origem do frontend (ignorando barra final e caminho configurados)', () => {
    expect(run({ origin: 'https://app.exemplo.com', cookies: session }).next).toHaveBeenCalled();
    expect(run({ allowed: 'https://app.exemplo.com/painel', origin: 'https://app.exemplo.com', cookies: session }).next).toHaveBeenCalled();
  });

  it('não interfere em GET, em webhooks sem cookie nem em chamadas sem Origin', () => {
    expect(run({ method: 'GET', origin: 'https://evil.com', cookies: session }).next).toHaveBeenCalled();
    expect(run({ origin: 'https://graph.facebook.com' }).next).toHaveBeenCalled();
    expect(run({ cookies: session }).next).toHaveBeenCalled();
  });

  it('sem WEB_APP_URL configurada o middleware fica desligado', () => {
    const mw = csrfOriginMiddleware(undefined);
    const next = jest.fn();
    mw({ method: 'POST', headers: { origin: 'https://evil.com' }, cookies: session } as any, {} as any, next);
    expect(next).toHaveBeenCalled();
  });
});
