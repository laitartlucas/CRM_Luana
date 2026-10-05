import { CSV_BOM, csvCell, csvDateTime, csvPercent, toCsv } from './csv';

describe('csvCell', () => {
  it('vazio para nulo e indefinido, texto simples sem aspas', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('Maria Souza')).toBe('Maria Souza');
    expect(csvCell(42)).toBe('42');
  });

  it('aspas quando há separador, aspas, ou quebra de linha — duplicando as aspas internas', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('ela disse "oi"')).toBe('"ela disse ""oi"""');
    expect(csvCell('linha 1\nlinha 2')).toBe('"linha 1\nlinha 2"');
  });

  it('vírgula não precisa de aspas (o separador é ponto e vírgula)', () => {
    expect(csvCell('Silva, Maria')).toBe('Silva, Maria');
  });

  it.each(['=1+1', '=HYPERLINK("http://evil","clique")', '+cmd|calc', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'neutraliza injeção de fórmula: %j',
    (payload) => {
      const cell = csvCell(payload);
      expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('preserva handles de Instagram, mas não @ com função ou operadores', () => {
    expect(csvCell('@maria.souza_22')).toBe('@maria.souza_22');
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('@a|b')).toBe("'@a|b");
  });

  it('preserva telefones e números (começar com + ou - não é fórmula)', () => {
    expect(csvCell('+5554999990000')).toBe('+5554999990000');
    expect(csvCell('-12,5')).toBe('-12,5');
    expect(csvCell('+55 54 99999-0000')).toBe("'+55 54 99999-0000"); // com espaços/traços não é número puro
  });

  it('datas viram ISO quando passadas cruas', () => {
    expect(csvCell(new Date('2026-10-05T12:00:00Z'))).toBe('2026-10-05T12:00:00.000Z');
  });
});

describe('toCsv', () => {
  it('BOM, cabeçalho, linhas separadas por CRLF e quebra final', () => {
    const csv = toCsv(['Nome', 'Cidade'], [['Ana', 'Caxias'], ['Bia', null]]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1)).toBe('Nome;Cidade\r\nAna;Caxias\r\nBia;\r\n');
  });

  it('sem linhas ainda traz o cabeçalho', () => {
    expect(toCsv(['A', 'B'], []).slice(1)).toBe('A;B\r\n');
  });
});

describe('formatadores', () => {
  it('data e hora no fuso informado', () => {
    expect(csvDateTime(new Date('2026-10-05T17:30:00Z'), 'America/Sao_Paulo')).toBe('05/10/2026 14:30');
    expect(csvDateTime(null, 'America/Sao_Paulo')).toBe('');
  });

  it('percentual com vírgula decimal', () => {
    expect(csvPercent(0.1234)).toBe('12,3%');
    expect(csvPercent(1)).toBe('100,0%');
    expect(csvPercent(null)).toBe('');
  });
});
