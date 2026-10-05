import { InboxListener } from './inbox.listener';

function makeListener() {
  const inbox: any = { notifyAllActive: jest.fn().mockResolvedValue(1), notifyUsers: jest.fn().mockResolvedValue(1) };
  const prisma: any = {
    client: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', name: 'Maria', funnelStage: 'CLIENT' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo', active: true }) },
  };
  return { listener: new InboxListener(inbox, prisma), inbox, prisma };
}

const appointment = (over: any = {}) => ({
  id: 'a1',
  clientId: 'c1',
  professionalId: 'u1',
  source: 'WHATSAPP',
  startAt: new Date('2026-10-10T17:30:00Z'), // 14:30 em São Paulo
  ...over,
});

describe('InboxListener', () => {
  it('lead nova avisa todos os usuários ativos', async () => {
    const { listener, inbox } = makeListener();
    await listener.onLeadCreated({ leadId: 'l1', name: 'Ana' });
    expect(inbox.notifyAllActive).toHaveBeenCalledWith({
      type: 'NEW_LEAD',
      title: 'Nova lead cadastrada',
      body: 'Ana',
      link: '/leads/l1',
      dedupeKey: 'lead:l1',
    });
  });

  it('agendamento feito pelo WhatsApp avisa a profissional, com data no fuso dela', async () => {
    const { listener, inbox } = makeListener();
    await listener.onAppointmentCreated({ appointment: appointment() } as any);
    expect(inbox.notifyUsers).toHaveBeenCalledWith(['u1'], {
      type: 'APPOINTMENT_BOOKED',
      title: 'Novo agendamento pelo WhatsApp',
      body: 'Maria · 10/10 às 14:30',
      link: '/clientes/c1',
      dedupeKey: 'appt-booked:a1',
    });
  });

  it('agendamento criado na tela (WEB) ou importado (GOOGLE) não gera aviso', async () => {
    const { listener, inbox } = makeListener();
    await listener.onAppointmentCreated({ appointment: appointment({ source: 'WEB' }) } as any);
    await listener.onAppointmentCreated({ appointment: appointment({ source: 'GOOGLE' }) } as any);
    expect(inbox.notifyUsers).not.toHaveBeenCalled();
  });

  it('cancelamento avisa a profissional e inclui o motivo', async () => {
    const { listener, inbox } = makeListener();
    await listener.onAppointmentCancelled({ appointment: appointment({ source: 'WEB' }), reason: 'Imprevisto' } as any);
    const [users, arg] = inbox.notifyUsers.mock.calls[0];
    expect(users).toEqual(['u1']);
    expect(arg).toMatchObject({ type: 'APPOINTMENT_CANCELLED', title: 'Agendamento cancelado', dedupeKey: 'appt-cancelled:a1' });
    expect(arg.body).toBe('Maria · 10/10 às 14:30 · Imprevisto');
  });

  it('não avisa se a profissional está inativa ou a cliente não existe mais', async () => {
    const a = makeListener();
    a.prisma.user.findUnique.mockResolvedValue({ timezone: 'UTC', active: false });
    await a.listener.onAppointmentCancelled({ appointment: appointment() } as any);
    const b = makeListener();
    b.prisma.client.findUnique.mockResolvedValue(null);
    await b.listener.onAppointmentCancelled({ appointment: appointment() } as any);
    expect(a.inbox.notifyUsers).not.toHaveBeenCalled();
    expect(b.inbox.notifyUsers).not.toHaveBeenCalled();
  });

  it('nunca propaga erro para quem emitiu o evento', async () => {
    const { listener, inbox } = makeListener();
    inbox.notifyAllActive.mockRejectedValue(new Error('banco fora do ar'));
    await expect(listener.onLeadCreated({ leadId: 'l1', name: null })).resolves.toBeUndefined();
  });
});
