import { formatInTimeZone } from 'date-fns-tz';

/** Marca de ordem de bytes: sem ela o Excel abre CSV em UTF-8 com os acentos quebrados. */
export const CSV_BOM = '﻿';
/** Ponto e vírgula: é o separador que o Excel em português espera (a vírgula é o decimal). */
export const CSV_DELIMITER = ';';

const FORMULA_START = /^[=+\-@\t\r]/;
// Números e telefones ("+5554999990000", "-12,5") começam com + ou - sem ser fórmula.
const SAFE_NUMBER = /^[+-]?\d[\d.,]*$/;
// Handle de Instagram ("@maria"): sem parênteses nem operadores, não executa nada — só um nome.
const SAFE_HANDLE = /^@[A-Za-z0-9_.]{1,30}$/;

/**
 * Uma célula de CSV, protegida de "injeção de fórmula": nomes e textos de leads vêm de fora
 * (formulários, webhook do Respondi) e, se começarem com =, +, - ou @, o Excel os executa como
 * fórmula ao abrir o arquivo. O apóstrofo inicial força o texto literal.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text) && !SAFE_NUMBER.test(text) && !SAFE_HANDLE.test(text)) text = `'${text}`;
  return /["\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(CSV_DELIMITER));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

export function csvDateTime(date: Date | null | undefined, timezone: string): string {
  return date ? formatInTimeZone(date, timezone, 'dd/MM/yyyy HH:mm') : '';
}

/** 0.1234 -> "12,3%". */
export function csvPercent(ratio: number | null | undefined): string {
  return ratio === null || ratio === undefined ? '' : `${(ratio * 100).toFixed(1).replace('.', ',')}%`;
}
