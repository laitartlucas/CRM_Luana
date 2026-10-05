import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './task.dto';

async function errorsOf<T extends object>(cls: new () => T, plain: object) {
  const errors = await validate(plainToInstance(cls, plain), { whitelist: true });
  return errors.map((e) => e.property);
}

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('CreateTaskDto', () => {
  it('aceita só o título', async () => {
    expect(await errorsOf(CreateTaskDto, { title: 'Ligar' })).toEqual([]);
  });

  it('rejeita título vazio, só espaços ou ausente', async () => {
    expect(await errorsOf(CreateTaskDto, { title: '' })).toContain('title');
    expect(await errorsOf(CreateTaskDto, { title: '   ' })).toContain('title');
    expect(await errorsOf(CreateTaskDto, {})).toContain('title');
  });

  it('valida prazo, prioridade e ids', async () => {
    expect(await errorsOf(CreateTaskDto, { title: 'x', dueAt: 'amanhã' })).toContain('dueAt');
    expect(await errorsOf(CreateTaskDto, { title: 'x', priority: 'URGENT' })).toContain('priority');
    expect(await errorsOf(CreateTaskDto, { title: 'x', assigneeId: 'abc' })).toContain('assigneeId');
    expect(await errorsOf(CreateTaskDto, { title: 'x', clientId: 'abc' })).toContain('clientId');
    expect(
      await errorsOf(CreateTaskDto, { title: 'x', dueAt: '2026-10-10T12:00:00.000Z', priority: 'HIGH', assigneeId: UUID, clientId: UUID }),
    ).toEqual([]);
  });

  it('limita título e descrição', async () => {
    expect(await errorsOf(CreateTaskDto, { title: 'a'.repeat(201) })).toContain('title');
    expect(await errorsOf(CreateTaskDto, { title: 'x', description: 'a'.repeat(2001) })).toContain('description');
  });
});

describe('UpdateTaskDto', () => {
  it('todos os campos são opcionais e null limpa prazo, descrição e vínculo', async () => {
    expect(await errorsOf(UpdateTaskDto, {})).toEqual([]);
    expect(await errorsOf(UpdateTaskDto, { dueAt: null, description: null, clientId: null })).toEqual([]);
  });
});

describe('ListTasksQueryDto', () => {
  it('aceita escopos conhecidos e converte limit para número', async () => {
    expect(await errorsOf(ListTasksQueryDto, { scope: 'overdue', limit: '50' })).toEqual([]);
    expect(plainToInstance(ListTasksQueryDto, { limit: '50' }).limit).toBe(50);
  });

  it('rejeita escopo desconhecido e limit fora da faixa', async () => {
    expect(await errorsOf(ListTasksQueryDto, { scope: 'tudo' })).toContain('scope');
    expect(await errorsOf(ListTasksQueryDto, { limit: '0' })).toContain('limit');
    expect(await errorsOf(ListTasksQueryDto, { limit: '9999' })).toContain('limit');
  });
});
