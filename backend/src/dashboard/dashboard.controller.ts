import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardQueryDto } from './dashboard-query.dto';
import { resolvePeriod } from '../common/utils/period';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today')
  today(@Query('professionalId') professionalId?: string) {
    return this.dashboardService.getToday(professionalId);
  }

  // Faturamento e taxas: só ADMIN/MANAGER. Sem período, o serviço usa o mês corrente.
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('kpis')
  kpis(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { from, to } = resolvePeriod(query, user.timezone);
    return this.dashboardService.getKpis({ professionalId: query.professionalId, from, to });
  }

  /** Agendamentos (sem cancelados) por dia local, com os dias sem nada zerados — alimenta o gráfico. */
  @Get('appointments-by-day')
  appointmentsByDay(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const period = resolvePeriod(query, user.timezone);
    return this.dashboardService.getAppointmentsByDay({ professionalId: query.professionalId, ...period });
  }
}
