import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CSV_BOM } from '../common/csv';
import { EXPORT_ROW_CAP, ReportsService } from './reports.service';

const user = { id: 'u1', email: 'a@b.c', role: Role.ADMIN, timezone: 'America/Sao_Paulo' } as const;

function makeService() {
  const prisma: any = {
    client: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const leads: any = { listForExport: jest.fn().mockResolvedValue({ total: 0, rows: [] }) };
  const pipeline: any = {
    funnelReport: jest.fn().mockResolvedValue({ mainPath: [], sideStages: [] }),
    originReport: jest.fn().mockResolvedValue([]),
  };
  return { service: new ReportsService(prisma, leads, pipeline), prisma, leads, pipeline };
}

const lines = (csv: string) => csv.replace(CSV_BOM, '').trimEnd().split('\r\n');

const leadRow = (over: any = {}) => ({
  id: 'l1',
  name: 'Maria Souza',
  phoneE164: '+5554999990000',
  instagram: '@maria',
  email: 'maria@x.y',
  city: 'Caxias do Sul',
  profession: 'Advogada',
  leadSource: 'REEL',
  funnelStage: 'PIPELINE',
  pipelineStage: 'CALL_SCHEDULED',
  leadScore: 72,
  createdAt: new Date('2026-10-05T17:30:00Z'),
  ...over,
});

describe('ReportsService.leadsCsv', () => {
  it('cabeçalho em português e linha com rótulos, telefone intacto e data no fuso do usuário', async () => {
    const { service, leads } = makeService();
    leads.listForExport.mockResolvedValue({ total: 1, rows: [leadRow()] });
    const file = await service.leadsCsv({}, user);
    const [header, row] = lines(file.csv);
    expect(header).toBe('Nome;WhatsApp;Instagram;E-mail;Cidade;Profissão;Origem;Situação;Etapa do pipeline;Score;Cadastrada em');
    expect(row).toBe('Maria Souza;+5554999990000;@maria;maria@x.y;Caxias do Sul;Advogada;Reel específico;No Pipeline;Call agendada;72;05/10/2026 14:30');
    expect(file.csv.startsWith(CSV_BOM)).toBe(true);
  });

  it('neutraliza fórmulas em textos vindos de fora (nome, Instagram, cidade)', async () => {
    const { service, leads } = makeService();
    leads.listForExport.mockResolvedValue({
      total: 1,
      rows: [leadRow({ name: '=HYPERLINK("http://evil.com","clique")', instagram: '@SUM(A1)', city: '+cmd|calc' })],
    });
    const { csv } = await service.leadsCsv({}, user);
    const row = lines(csv)[1];
    expect(row).toContain(`"'=HYPERLINK(""http://evil.com"",""clique"")"`);
    expect(row).toContain(";'@SUM(A1);");
    expect(row).toContain(";'+cmd|calc;");
  });

  it('repassa filtros e o período (no fuso do usuário) e avisa quando o limite cortou o resultado', async () => {
    const { service, leads } = makeService();
    leads.listForExport.mockResolvedValue({ total: EXPORT_ROW_CAP + 5, rows: [leadRow()] });
    const file = await service.leadsCsv({ source: 'REEL' as any, from: '2026-10-01', to: '2026-10-31' }, user);

    const [filters, period, cap] = leads.listForExport.mock.calls[0];
    expect(filters).toMatchObject({ source: 'REEL' });
    expect(period.from.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(cap).toBe(EXPORT_ROW_CAP);
    expect(file.truncated).toBe(true);
  });

  it('período inválido é erro 400 e nada é exportado nem auditado', async () => {
    const { service, leads, prisma } = makeService();
    await expect(service.leadsCsv({ from: '2026-10-31', to: '2026-10-01' }, user)).rejects.toBeInstanceOf(BadRequestException);
    expect(leads.listForExport).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('registra a exportação no audit log com quem, quais filtros e quantas linhas', async () => {
    const { service, leads, prisma } = makeService();
    leads.listForExport.mockResolvedValue({ total: 2, rows: [leadRow(), leadRow({ id: 'l2' })] });
    await service.leadsCsv({ search: 'maria' }, user);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'u1', entity: 'export', entityId: 'leads', action: 'EXPORT', after: { filters: { search: 'maria' }, rows: 2 } },
    });
  });

  it('falha ao auditar não derruba a exportação', async () => {
    const { service, prisma } = makeService();
    prisma.auditLog.create.mockRejectedValue(new Error('banco fora'));
    await expect(service.leadsCsv({}, user)).resolves.toMatchObject({ rows: 0 });
  });

  it('nome do arquivo leva a data de hoje no fuso do usuário', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-06T02:00:00Z')); // ainda 05/10 em São Paulo
    try {
      const { service } = makeService();
      expect((await service.leadsCsv({}, user)).filename).toBe('leads-2026-10-05.csv');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ReportsService.clientsCsv', () => {
  it('lista só clientes, com etapa traduzida, risco em % e período por data de cadastro', async () => {
    const { service, prisma } = makeService();
    prisma.client.count.mockResolvedValue(1);
    prisma.client.findMany.mockResolvedValue([
      {
        name: 'Bia',
        phoneE164: '+5511900000000',
        email: null,
        predominantStyle: 'Clássico',
        successStage: 'RENEWAL',
        paymentMethod: 'Pix',
        noShowScore: 0.25,
        createdAt: new Date('2026-09-01T15:00:00Z'),
      },
    ]);
    const file = await service.clientsCsv({ from: '2026-09-01', to: '2026-09-30', successStage: 'RENEWAL' as any }, user);

    const where = prisma.client.findMany.mock.calls[0][0].where.AND;
    expect(where[0]).toEqual({ funnelStage: 'CLIENT' });
    expect(where[1]).toEqual({ successStage: 'RENEWAL' });
    expect(where[3].createdAt.gte.toISOString()).toBe('2026-09-01T03:00:00.000Z');

    const [header, row] = lines(file.csv);
    expect(header).toBe('Nome;WhatsApp;E-mail;Estilo predominante;Etapa;Forma de pagamento;Risco de falta;Cadastrada em');
    expect(row).toBe('Bia;+5511900000000;;Clássico;Renovação;Pix;25,0%;01/09/2026 12:00');
    expect(file.filename).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('marca como cortado quando há mais clientes que o limite', async () => {
    const { service, prisma } = makeService();
    prisma.client.count.mockResolvedValue(EXPORT_ROW_CAP + 1);
    prisma.client.findMany.mockResolvedValue([]);
    expect((await service.clientsCsv({}, user)).truncated).toBe(true);
  });
});

describe('ReportsService funil e origem', () => {
  it('funil: etapas principais com conversão e saídas laterais sem conversão', async () => {
    const { service, pipeline } = makeService();
    pipeline.funnelReport.mockResolvedValue({
      mainPath: [
        { stage: 'NEW', count: 10, conversionFromPrevious: null },
        { stage: 'FIRST_CONTACT', count: 5, conversionFromPrevious: 0.5 },
      ],
      sideStages: [{ stage: 'NO_SHOW', count: 2 }],
    });
    const { csv } = await service.funnelCsv({ from: '2026-10-01', to: '2026-10-31' }, user);
    expect(lines(csv)).toEqual([
      'Tipo;Etapa;Leads que chegaram;Conversão sobre a etapa anterior',
      'Funil principal;Lead nova;10;',
      'Funil principal;Primeiro contato;5;50,0%',
      'Saída lateral;Não compareceu;2;',
    ]);
    expect(pipeline.funnelReport.mock.calls[0][0].toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });

  it('origem: leads, fechamentos e conversão por origem/conteúdo', async () => {
    const { service, pipeline } = makeService();
    pipeline.originReport.mockResolvedValue([
      { leadSource: 'REEL', contentRef: 'https://instagram.com/reel/abc', leads: 8, closedWon: 2, conversionRate: 0.25 },
      { leadSource: 'REFERRAL', contentRef: null, leads: 3, closedWon: 1, conversionRate: 1 / 3 },
    ]);
    const { csv } = await service.originsCsv({}, user);
    expect(lines(csv)).toEqual([
      'Origem;Conteúdo (link/descrição);Leads;Fecharam;Conversão',
      'Reel específico;https://instagram.com/reel/abc;8;2;25,0%',
      'Indicação;;3;1;33,3%',
    ]);
  });
});
