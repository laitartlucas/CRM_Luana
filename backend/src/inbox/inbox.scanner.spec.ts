import { InboxScanner } from './inbox.scanner';

const now = new Date('2026-10-05T17:00:00Z'); // 14:00 em São Paulo

function makeScanner() {
  const prisma: any = {
    task: { findMany: jest.fn().mockResolvedValue([]) },
    conversation: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const inbox: any = {
    notifyUsers: jest.fn().mockResolvedValue(1),
    notifyAllActive: jest.fn().mockResolvedValue(2),
    purgeOld: jest.fn().mockResolvedValue(0),
  };
  return { scanner: new InboxScanner(prisma, inbox), prisma, inbox };
}

const assignee = { id: 'u1', active: true, timezone: 'America/Sao_Paulo' };
const task = (over: any = {}) => ({
  id: 't1',
  title: 'Enviar proposta',
  dueAt: new Date('2026-10-05T17:30:00Z'), // 14:30 SP, daqui a 30 min
  assignee,
  client: { name: 'Maria' },
  ...over,
});

describe('InboxScanner.scanTasks', () => {
  it('consulta só tarefas abertas com responsável, dentro da janela de varredura', async () => {
    const { scanner, prisma } = makeScanner();
    await scanner.scanTasks(now);
    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('OPEN');
    expect(where.assigneeId).toEqual({ not: null });
    expect(where.dueAt.gte).toEqual(new Date('2026-10-02T17:00:00Z'));
    expect(where.dueAt.lte).toEqual(new Date('2026-10-06T17:00:00Z'));
  });

  it('avisa o responsável sobre tarefa prestes a vencer, com chave única por tarefa e prazo', async () => {
    const { scanner, prisma, inbox } = makeScanner();
    prisma.task.findMany.mockResolvedValue([task()]);
    await expect(scanner.scanTasks(now)).resolves.toBe(1);
    expect(inbox.notifyUsers).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({
        type: 'TASK_DUE',
        title: 'Tarefa para daqui a pouco: Enviar proposta',
        body: 'Sobre Maria',
        link: '/tarefas',
        dedupeKey: `task-due:t1:${new Date('2026-10-05T17:30:00Z').getTime()}`,
      }),
    );
  });

  it('muda a chave quando o prazo muda (novo aviso), e marca atrasada depois do prazo', async () => {
    const { scanner, prisma, inbox } = makeScanner();
    prisma.task.findMany.mockResolvedValue([task({ dueAt: new Date('2026-10-05T16:00:00Z') })]);
    await scanner.scanTasks(now);
    const arg = inbox.notifyUsers.mock.calls[0][1];
    expect(arg.title).toBe('Tarefa atrasada: Enviar proposta');
    expect(arg.dedupeKey).toBe(`task-due:t1:${new Date('2026-10-05T16:00:00Z').getTime()}`);
  });

  it('ignora tarefa ainda distante, sem responsável ativo ou sem prazo', async () => {
    const { scanner, prisma, inbox } = makeScanner();
    prisma.task.findMany.mockResolvedValue([
      task({ dueAt: new Date('2026-10-05T21:00:00Z') }), // 18:00 SP: ainda longe
      task({ id: 't2', assignee: { ...assignee, active: false } }),
      task({ id: 't3', assignee: null }),
      task({ id: 't4', dueAt: null }),
    ]);
    await expect(scanner.scanTasks(now)).resolves.toBe(0);
    expect(inbox.notifyUsers).not.toHaveBeenCalled();
  });
});

describe('InboxScanner.scanHandoffs', () => {
  const conversation = (lastDirection: 'IN' | 'OUT' | null, over: any = {}) => ({
    id: 'cv1',
    client: { id: 'c1', name: 'Joana', funnelStage: 'LEAD' },
    messages: lastDirection ? [{ id: 'm1', direction: lastDirection, content: 'Oi, quero falar\ncom a Luana' }] : [],
    ...over,
  });

  it('só olha conversas que aguardam humano e tiveram mensagem nas últimas 24h', async () => {
    const { scanner, prisma } = makeScanner();
    await scanner.scanHandoffs(now);
    const where = prisma.conversation.findMany.mock.calls[0][0].where;
    expect(where.needsHuman).toBe(true);
    expect(where.lastMessageAt.gte).toEqual(new Date('2026-10-04T17:00:00Z'));
  });

  it('avisa todos os ativos quando a última mensagem é do cliente, com o texto resumido e link da ficha', async () => {
    const { scanner, prisma, inbox } = makeScanner();
    prisma.conversation.findMany.mockResolvedValue([conversation('IN')]);
    await expect(scanner.scanHandoffs(now)).resolves.toBe(2);
    expect(inbox.notifyAllActive).toHaveBeenCalledWith({
      type: 'HUMAN_HANDOFF',
      title: 'Joana está aguardando atendimento',
      body: 'Oi, quero falar com a Luana',
      link: '/leads/c1',
      dedupeKey: 'handoff:m1',
    });
  });

  it('não avisa quando a última mensagem já é a resposta da Luana ou não há mensagens', async () => {
    const { scanner, prisma, inbox } = makeScanner();
    prisma.conversation.findMany.mockResolvedValue([conversation('OUT'), conversation(null)]);
    await expect(scanner.scanHandoffs(now)).resolves.toBe(0);
    expect(inbox.notifyAllActive).not.toHaveBeenCalled();
  });

  it('usa /clientes para quem já é cliente e um título genérico sem nome', async () => {
    const { scanner, prisma, inbox } = makeScanner();
    prisma.conversation.findMany.mockResolvedValue([
      conversation('IN', { client: { id: 'c9', name: null, funnelStage: 'CLIENT' } }),
    ]);
    await scanner.scanHandoffs(now);
    const arg = inbox.notifyAllActive.mock.calls[0][0];
    expect(arg.link).toBe('/clientes/c9');
    expect(arg.title).toBe('Um contato está aguardando atendimento');
  });
});

describe('InboxScanner.run', () => {
  it('executa as três etapas e devolve os totais', async () => {
    const { scanner, inbox } = makeScanner();
    inbox.purgeOld.mockResolvedValue(5);
    await expect(scanner.run(now)).resolves.toEqual({ tasks: 0, handoffs: 0, purged: 5 });
  });
});
