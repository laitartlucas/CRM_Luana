import { DashboardService } from './dashboard.service';

function makeService(startAts: Date[] = [], timezone = 'America/Sao_Paulo') {
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ timezone }),
      findFirst: jest.fn().mockResolvedValue({ timezone }),
    },
    appointment: { findMany: jest.fn().mockResolvedValue(startAts.map((startAt) => ({ startAt }))) },
  };
  return { service: new DashboardService(prisma), prisma };
}

const SP = (iso: string) => new Date(`${iso}-03:00`); // hora de parede de São Paulo (UTC-3)

describe('DashboardService.getAppointmentsByDay', () => {
  const period = { from: SP('2026-10-01T00:00:00'), to: SP('2026-10-05T23:59:59') };

  it('devolve todos os dias do período, com zero nos dias sem agendamento', async () => {
    const { service } = makeService([SP('2026-10-02T09:00:00'), SP('2026-10-02T15:00:00'), SP('2026-10-04T10:00:00')]);
    const days = await service.getAppointmentsByDay(period);
    expect(days).toEqual([
      { date: '2026-10-01', count: 0 },
      { date: '2026-10-02', count: 2 },
      { date: '2026-10-03', count: 0 },
      { date: '2026-10-04', count: 1 },
      { date: '2026-10-05', count: 0 },
    ]);
  });

  it('agrupa pelo dia do fuso do profissional: 23:30 em São Paulo (02:30 UTC do dia seguinte) conta no dia certo', async () => {
    const { service } = makeService([SP('2026-10-03T23:30:00')]);
    const days = await service.getAppointmentsByDay(period);
    expect(days.find((d) => d.date === '2026-10-03')?.count).toBe(1);
    expect(days.find((d) => d.date === '2026-10-04')?.count).toBe(0);
  });

  it('exclui cancelados na consulta e filtra pelo período e pela profissional', async () => {
    const { service, prisma } = makeService();
    await service.getAppointmentsByDay({ ...period, professionalId: 'p1' });
    const where = prisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: 'CANCELLED' });
    expect(where.professionalId).toBe('p1');
    expect(where.startAt).toEqual({ gte: period.from, lte: period.to });
  });

  it('sem período, usa os últimos 7 dias terminando hoje', async () => {
    jest.useFakeTimers().setSystemTime(SP('2026-10-05T12:00:00'));
    try {
      const { service } = makeService();
      const days = await service.getAppointmentsByDay({});
      expect(days.map((d) => d.date)).toEqual([
        '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('um período de um dia só devolve um ponto', async () => {
    const { service } = makeService();
    const days = await service.getAppointmentsByDay({ from: SP('2026-10-05T00:00:00'), to: SP('2026-10-05T23:59:59') });
    expect(days).toEqual([{ date: '2026-10-05', count: 0 }]);
  });
});
