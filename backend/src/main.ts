import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true é necessário para validar a assinatura HMAC dos webhooks
  // da Meta (WhatsAppController#verifySignature) contra o corpo exato
  // recebido, antes de qualquer parsing JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // Backend só é alcançado atrás de proxy (nginx do frontend e/ou edge do
  // Railway) — sem isso, req.ip vira o IP do proxy pra todo mundo e o
  // rate limit do login passa a valer por proxy, não por cliente real.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
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
