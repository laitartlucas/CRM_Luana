import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FunnelStage, PipelineStage } from '@prisma/client';
import { PipelineService } from './pipeline.service';
import { PIPELINE_EVENTS } from './pipeline.events';

function makeService(overrides: { client?: any } = {}) {
  const prisma: any = {
    client: {
      findUnique: jest.fn().mockResolvedValue(overrides.client),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation((args) => ({ __op: 'client.update', ...args })),
    },
    funnelStageEvent: {
      updateMany: jest.fn().mockReturnValue({ __op: 'event.updateMany' }),
      create: jest.fn().mockImplementation((args) => ({ __op: 'event.create', ...args })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation(async (ops: any[]) => ops),
  };
  const events: any = { emit: jest.fn() };
  return { service: new PipelineService(prisma, events), prisma, events };
}

const activeCard = {
  id: 'c1',
  funnelStage: FunnelStage.PIPELINE,
  pipelineStage: PipelineStage.FIRST_CONTACT,
  callDate: null,
};

describe('PipelineService.changeStage', () => {
  it('rejeita registro inexistente', async () => {
    const { service } = makeService({ client: null });
    await expect(service.changeStage('x', { toStage: PipelineStage.PRE_CALL })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita registro que não está mais no Pipeline', async () => {
    const { service } = makeService({ client: { ...activeCard, funnelStage: FunnelStage.CLIENT } });
    await expect(service.changeStage('c1', { toStage: PipelineStage.PRE_CALL })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige callDate ao mover para Call agendada', async () => {
    const { service, prisma } = makeService({ client: activeCard });
    await expect(service.changeStage('c1', { toStage: PipelineStage.CALL_SCHEDULED })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('avanço normal mantém FunnelStage PIPELINE e emite evento', async () => {
    const { service, prisma, events } = makeService({ client: activeCard });
    await service.changeStage('c1', { toStage: PipelineStage.PRE_CALL }, 'u1');

    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(3);
    const update = ops.find((o: any) => o.__op === 'client.update');
    expect(update.data.funnelStage).toBe(FunnelStage.PIPELINE);
    expect(update.data.pipelineStage).toBe(PipelineStage.PRE_CALL);
    expect(events.emit).toHaveBeenCalledWith(
      PIPELINE_EVENTS.STAGE_CHANGED,
      expect.objectContaining({ fromStage: PipelineStage.FIRST_CONTACT, toStage: PipelineStage.PRE_CALL, changedByUserId: 'u1' }),
    );
  });

  it('CLOSED_WON vira CLIENT e inicializa o módulo de sucesso na mesma transação', async () => {
    const { service, prisma } = makeService({ client: activeCard });
    await service.changeStage('c1', { toStage: PipelineStage.CLOSED_WON });

    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(5);
    const updates = ops.filter((o: any) => o.__op === 'client.update');
    expect(updates[0].data.funnelStage).toBe(FunnelStage.CLIENT);
    expect(updates[1].data.successStage).toBe('NEW_CLIENT');
    const successEvent = ops.find((o: any) => o.__op === 'event.create' && o.data.module === 'SUCCESS');
    expect(successEvent.data.toStage).toBe('NEW_CLIENT');
  });

  it('CLOSED_LOST vira LOST sem iniciar o módulo de sucesso', async () => {
    const { service, prisma } = makeService({ client: activeCard });
    await service.changeStage('c1', { toStage: PipelineStage.CLOSED_LOST });

    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(3);
    expect(ops.find((o: any) => o.__op === 'client.update').data.funnelStage).toBe(FunnelStage.LOST);
  });
});

describe('PipelineService.funnelReport', () => {
  it('conta clientes únicos por etapa e calcula conversão sobre a etapa anterior', async () => {
    const { service, prisma } = makeService();
    prisma.funnelStageEvent.findMany.mockResolvedValue([
      { clientId: 'a', toStage: 'NEW' },
      { clientId: 'b', toStage: 'NEW' },
      { clientId: 'c', toStage: 'NEW' },
      { clientId: 'd', toStage: 'NEW' },
      { clientId: 'a', toStage: 'FIRST_CONTACT' },
      { clientId: 'a', toStage: 'FIRST_CONTACT' }, // duplicado não conta duas vezes
      { clientId: 'b', toStage: 'FIRST_CONTACT' },
      { clientId: 'c', toStage: 'NO_SHOW' },
    ]);

    const report = await service.funnelReport();
    const byStage = Object.fromEntries(report.mainPath.map((e) => [e.stage, e]));
    expect(byStage.NEW.count).toBe(4);
    expect(byStage.NEW.conversionFromPrevious).toBeNull();
    expect(byStage.FIRST_CONTACT.count).toBe(2);
    expect(byStage.FIRST_CONTACT.conversionFromPrevious).toBe(0.5);
    expect(byStage.CALL_SCHEDULED.conversionFromPrevious).toBe(0);
    expect(report.sideStages.find((s) => s.stage === 'NO_SHOW')!.count).toBe(1);
  });
});

describe('PipelineService.metrics', () => {
  it('calcula ticket médio ignorando propostas sem valor e a forma de pagamento mais usada', async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany
      .mockResolvedValueOnce([{ proposalValue: 1000 }, { proposalValue: 500 }, { proposalValue: null }])
      .mockResolvedValueOnce([{ paymentMethod: 'Pix' }, { paymentMethod: 'Pix' }, { paymentMethod: 'Boleto' }]);

    const metrics = await service.metrics();
    expect(metrics.averageTicket).toBe(750);
    expect(metrics.mostUsedPaymentMethod).toBe('Pix');
    expect(metrics.closedWonCount).toBe(3);
  });

  it('retorna zeros quando não há dados', async () => {
    const { service } = makeService();
    const metrics = await service.metrics();
    expect(metrics.averageTicket).toBe(0);
    expect(metrics.mostUsedPaymentMethod).toBeNull();
    expect(metrics.avgTimePerStageHours).toEqual([]);
  });
});
