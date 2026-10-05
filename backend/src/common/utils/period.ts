import { BadRequestException } from '@nestjs/common';
import { fromZonedTime } from 'date-fns-tz';

/** Limite do período de um relatório: evita consultas enormes (e erros de digitação como o ano 1900). */
export const MAX_PERIOD_DAYS = 400;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function invalid(): never {
  throw new BadRequestException('Período inválido. Use datas no formato AAAA-MM-DD.');
}

/** "2026-10-05" -> início ou fim desse dia no fuso informado (não no do servidor). */
function parseBound(value: string, timezone: string, edge: 'start' | 'end'): Date {
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    // Rejeita datas que o JS "corrige" sozinho, como 2026-02-31.
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) invalid();
    return fromZonedTime(`${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}`, timezone);
  }
  // Instante completo (clientes antigos mandavam ISO): vale como está.
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) invalid();
  return instant;
}

/**
 * Período de um relatório a partir de ?from=&to=. Datas "AAAA-MM-DD" valem do começo do dia
 * inicial ao fim do dia final no fuso de quem consulta. Sem nenhuma das duas = sem filtro;
 * só uma delas, fim antes do início ou período longo demais = erro 400 (antes viravam 500 ou
 * resultados silenciosamente errados).
 */
export function resolvePeriod(query: { from?: string; to?: string }, timezone: string): { from?: Date; to?: Date } {
  const { from, to } = query;
  if (!from && !to) return {};
  if (!from || !to) throw new BadRequestException('Informe as duas datas do período (início e fim).');

  const start = parseBound(from, timezone, 'start');
  const end = parseBound(to, timezone, 'end');
  if (start > end) throw new BadRequestException('A data inicial não pode ser depois da final.');
  if ((end.getTime() - start.getTime()) / DAY_MS > MAX_PERIOD_DAYS) {
    throw new BadRequestException(`O período pode ter no máximo ${MAX_PERIOD_DAYS} dias.`);
  }
  return { from: start, to: end };
}
