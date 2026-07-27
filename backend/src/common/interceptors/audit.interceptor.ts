import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ENTITY_KEY } from '../decorators/audit.decorator';
import { AuditAction } from '@prisma/client';

/**
 * Interceptor global de auditoria. Handlers de escrita marcados com
 * @Audit('entityName') têm o estado "antes" (para UPDATE/DELETE) capturado
 * antes de executar, e o resultado do handler gravado como "depois".
 * Nunca lança: uma falha ao gravar auditoria não deve derrubar a request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const entity = this.reflector.getAllAndOverride<string>(AUDIT_ENTITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!entity) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method as string;
    const entityId: string | undefined = request.params?.id;
    const userId: string | undefined = request.user?.id;
    const reason: string | undefined = request.body?.auditReason;

    const action: AuditAction =
      method === 'POST' ? AuditAction.CREATE : method === 'DELETE' ? AuditAction.DELETE : AuditAction.UPDATE;

    let before: unknown = null;
    if (action !== AuditAction.CREATE && entityId) {
      before = await this.safeFindById(entity, entityId);
    }

    return next.handle().pipe(
      tap((result) => {
        const after = action === AuditAction.DELETE ? null : (result ?? null);
        const finalEntityId = entityId ?? result?.id;
        if (!finalEntityId) return;

        this.prisma.auditLog
          .create({
            data: {
              userId: userId ?? null,
              entity,
              entityId: finalEntityId,
              action,
              before: before as any,
              after: after as any,
              reason: reason ?? null,
            },
          })
          .catch((err) => this.logger.warn(`Falha ao gravar audit log de ${entity}: ${err.message}`));
      }),
    );
  }

  private async safeFindById(entity: string, id: string): Promise<unknown> {
    try {
      const model = (this.prisma as any)[entity];
      if (!model?.findUnique) return null;
      return await model.findUnique({ where: { id } });
    } catch (err) {
      this.logger.warn(`Falha ao buscar estado anterior de ${entity}#${id}: ${(err as Error).message}`);
      return null;
    }
  }
}
