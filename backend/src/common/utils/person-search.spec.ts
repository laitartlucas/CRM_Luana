import { personSearchFilter } from './person-search';

describe('personSearchFilter', () => {
  it('sem termo não filtra', () => {
    expect(personSearchFilter(undefined)).toBeUndefined();
    expect(personSearchFilter('')).toBeUndefined();
    expect(personSearchFilter('   ')).toBeUndefined();
  });

  it('busca nome, Instagram e e-mail por trecho, sem diferenciar maiúsculas', () => {
    expect(personSearchFilter(' Maria ')).toEqual({
      OR: [
        { name: { contains: 'Maria', mode: 'insensitive' } },
        { instagram: { contains: 'Maria', mode: 'insensitive' } },
        { email: { contains: 'Maria', mode: 'insensitive' } },
      ],
    });
  });

  it('com 3 ou mais dígitos também busca no telefone, ignorando a formatação digitada', () => {
    const filter = personSearchFilter('(54) 99999-0000');
    expect(filter?.OR).toContainEqual({ phoneE164: { contains: '54999990000' } });
  });

  it('menos de 3 dígitos não entra no telefone (evita casar com qualquer número)', () => {
    expect(personSearchFilter('12')?.OR).toHaveLength(3);
    expect(personSearchFilter('Rua 12')?.OR).toHaveLength(3);
  });
});
