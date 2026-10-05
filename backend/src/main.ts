import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { csrfOriginMiddleware } from './common/middleware/csrf-origin.middleware';

async function bootstrap() {
  // rawBody: true é necessário para validar a assinatura HMAC dos webhooks
  // da Meta (WhatsAppController#verifySignature) contra o corpo exato
  // recebido, antes de qualquer parsing JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // X-Forwarded-For real observado em produção: "<client>, <edge-railway>,
  // <relay-interno>" + a própria conexão TCP direta (nginx do frontend)
  // como um salto implícito adicional — total de 3 saltos confiáveis até
  // chegar no IP real do cliente. Os dois saltos intermediários mudam a
  // cada request (edge/relay são dinâmicos), então um número errado aqui
  // fazia o Express "ver" um cliente diferente a cada tentativa de login,
  // quebrando o rate limit por IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 3);
  app.use(helmet());
  app.use(cookieParser());
  app.use(csrfOriginMiddleware(config.get<string>('WEB_APP_URL')));
  app.enableCors({
    origin: config.get<string>('WEB_APP_URL'),
    credentials: true,
    // O navegador só deixa o front ler este cabeçalho (aviso de exportação cortada) se for exposto.
    exposedHeaders: ['X-Export-Truncated'],
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`CRM backend rodando em http://localhost:${port}`);
}

bootstrap();
