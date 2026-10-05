import { Prisma } from '@prisma/client';

/**
 * Filtro de busca por pessoa (lead/cliente), único para listagens e busca
 * global: nome, Instagram e e-mail por trecho (sem diferenciar maiúsculas) e
 * telefone só pelos dígitos — "(54) 99999" acha "+5554999990000". Com menos
 * de 3 dígitos o telefone não entra, para "12" não casar com qualquer número.
 */
export function personSearchFilter(term: string | undefined): Prisma.ClientWhereInput | undefined {
  const text = term?.trim();
  if (!text) return undefined;

  const digits = text.replace(/\D/g, '');
  const or: Prisma.ClientWhereInput[] = [
    { name: { contains: text, mode: 'insensitive' } },
    { instagram: { contains: text, mode: 'insensitive' } },
    { email: { contains: text, mode: 'insensitive' } },
  ];
  if (digits.length >= 3) or.push({ phoneE164: { contains: digits } });
  return { OR: or };
}
