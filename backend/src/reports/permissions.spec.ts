import 'reflect-metadata';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { DashboardController } from '../dashboard/dashboard.controller';
import { PipelineController } from '../pipeline/pipeline.controller';
import { ReportsController } from './reports.controller';

const rolesOf = (target: object, method?: string) =>
  Reflect.getMetadata(ROLES_KEY, method ? (target as any)[method] : target) as Role[] | undefined;

const MANAGERS = [Role.ADMIN, Role.MANAGER];

describe('Permissões de relatórios (ATTENDANT não acessa dados de receita nem exporta dados pessoais)', () => {
  it('todas as exportações em CSV exigem ADMIN ou MANAGER (no controller inteiro)', () => {
    expect(rolesOf(ReportsController)).toEqual(MANAGERS);
  });

  it.each(['funnelReport', 'originReport', 'metrics'])('pipeline/%s exige ADMIN ou MANAGER', (method) => {
    expect(rolesOf(PipelineController.prototype, method)).toEqual(MANAGERS);
  });

  it('KPIs do painel (faturamento) exigem ADMIN ou MANAGER', () => {
    expect(rolesOf(DashboardController.prototype, 'kpis')).toEqual(MANAGERS);
  });

  it('o resumo do dia e o gráfico de agendamentos continuam abertos a todos os papéis', () => {
    expect(rolesOf(DashboardController.prototype, 'today')).toBeUndefined();
    expect(rolesOf(DashboardController.prototype, 'appointmentsByDay')).toBeUndefined();
  });

  it('o board do pipeline (operação diária) continua aberto', () => {
    expect(rolesOf(PipelineController.prototype, 'board')).toBeUndefined();
  });
});
