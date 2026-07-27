import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca um handler como não exigindo sessão autenticada (ex.: login, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
