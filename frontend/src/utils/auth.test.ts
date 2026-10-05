import { describe, expect, it } from 'vitest';
import { loginUrlFor, safeNextPath } from './auth';

describe('safeNextPath', () => {
  it('aceita caminhos internos, com query e hash', () => {
    expect(safeNextPath('/tarefas')).toBe('/tarefas');
    expect(safeNextPath('/leads?page=2&source=REEL')).toBe('/leads?page=2&source=REEL');
    expect(safeNextPath('/clientes/abc#fichas')).toBe('/clientes/abc#fichas');
  });

  it('bloqueia redirecionamento para fora do app', () => {
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
  });

  it('não volta para a tela de login nem aceita vazio', () => {
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath('/login?next=/x')).toBe('/');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
  });
});

describe('loginUrlFor', () => {
  it('guarda onde a pessoa estava, codificado', () => {
    expect(loginUrlFor('/leads?page=2&q=maria souza')).toBe('/login?next=%2Fleads%3Fpage%3D2%26q%3Dmaria%20souza');
  });

  it('na raiz ou em destino inválido vai para o login limpo', () => {
    expect(loginUrlFor('/')).toBe('/login');
    expect(loginUrlFor('/login')).toBe('/login');
    expect(loginUrlFor('//evil.com')).toBe('/login');
  });
});
