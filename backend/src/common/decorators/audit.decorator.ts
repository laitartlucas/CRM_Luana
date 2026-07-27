import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_KEY = 'auditEntity';

/**
 * Marca um handler de escrita para ser registrado no log de auditoria.
 * `entity` deve ser o nome do model Prisma em camelCase (ex.: 'appointment',
 * 'client') — é usado para buscar o estado "antes" via `prisma[entity]`.
 */
export const Audit = (entity: string) => SetMetadata(AUDIT_ENTITY_KEY, entity);
