import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { join } from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { CatalogModule } from './catalog/catalog.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { CalendarSyncModule } from './calendar-sync/calendar-sync.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeadsModule } from './leads/leads.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { IntakeModule } from './intake/intake.module';
import { ClientSuccessModule } from './client-success/client-success.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    // Limite geral (guarda-chuva); rotas sensíveis (login) usam @Throttle
    // com um limite bem mais apertado — ver auth.controller.ts.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
      }),
    }),
    PrismaModule,
    CryptoModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    CatalogModule,
    AppointmentsModule,
    CalendarSyncModule,
    WhatsappModule,
    NotificationsModule,
    DashboardModule,
    LeadsModule,
    PipelineModule,
    IntakeModule,
    ClientSuccessModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    },
  ],
})
export class AppModule {}
