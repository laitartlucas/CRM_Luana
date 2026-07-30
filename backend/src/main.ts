import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true é necessário para validar a assinatura HMAC dos webhooks
  // da Meta (WhatsAppController#verifySignature) contra o corpo exato
  // recebido, antes de qualquer parsing JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // Tráfego real do app passa por 2 saltos até aqui: edge do Railway
  // (client -> edge) + proxy nginx do frontend (edge -> nginx -> aqui, via
  // rede privada). Um número errado de saltos faz o Express extrair um IP
  // diferente a cada request (às vezes o do próprio proxy), quebrando o
  // rate limit por IP do login — cada tentativa "parecia" vir de um
  // cliente novo.
  app.getHttpAdapter().getInstance().set('trust proxy', 2);
  // DEBUG TEMPORÁRIO — remover depois de diagnosticar o rate limit.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path.startsWith('/auth/')) {
      // eslint-disable-next-line no-console
      console.log('DEBUG_IP', JSON.stringify({ xff: req.headers['x-forwarded-for'], ip: req.ip, ips: (req as any).ips }));
    }
    next();
  });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('WEB_APP_URL'),
    credentials: true,
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`CRM backend rodando em http://localhost:${port}`);
}

bootstrap();
