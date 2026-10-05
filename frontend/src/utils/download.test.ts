// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blobErrorMessage, filenameFrom } from './download';

describe('filenameFrom', () => {
  it('extrai o nome do Content-Disposition, com ou sem aspas', () => {
    expect(filenameFrom('attachment; filename="leads-2026-10-05.csv"', 'x.csv')).toBe('leads-2026-10-05.csv');
    expect(filenameFrom('attachment; filename=funil.csv', 'x.csv')).toBe('funil.csv');
    expect(filenameFrom("attachment; filename*=UTF-8''origem%20das%20leads.csv", 'x.csv')).toBe('origem das leads.csv');
  });

  it('usa o nome reserva quando o cabeçalho não existe (CORS não expôs) ou não tem nome', () => {
    expect(filenameFrom(undefined, 'reserva.csv')).toBe('reserva.csv');
    expect(filenameFrom('attachment', 'reserva.csv')).toBe('reserva.csv');
  });
});

describe('blobErrorMessage', () => {
  const blobOf = (obj: unknown) => new Blob([JSON.stringify(obj)], { type: 'application/json' });

  it('lê a mensagem dentro do Blob de erro da API', async () => {
    const err = { response: { data: blobOf({ statusCode: 400, message: 'O período pode ter no máximo 400 dias.' }) } };
    await expect(blobErrorMessage(err, 'padrão')).resolves.toBe('O período pode ter no máximo 400 dias.');
  });

  it('junta mensagens em lista', async () => {
    const err = { response: { data: blobOf({ message: ['a', 'b'] }) } };
    await expect(blobErrorMessage(err, 'padrão')).resolves.toBe('a b');
  });

  it('usa o texto padrão se o corpo não for JSON, não for Blob ou não houver resposta', async () => {
    await expect(blobErrorMessage({ response: { data: new Blob(['<html>']) } }, 'padrão')).resolves.toBe('padrão');
    await expect(blobErrorMessage({ response: { data: 'texto' } }, 'padrão')).resolves.toBe('padrão');
    await expect(blobErrorMessage(new Error('rede'), 'padrão')).resolves.toBe('padrão');
  });
});
