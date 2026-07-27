import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today')
  today(@Query('professionalId') professionalId?: string) {
    return this.dashboardService.getToday(professionalId);
  }

  @Get('kpis')
  kpis(
    @Query('professionalId') professionalId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return this.dashboardService.getKpis({
      professionalId,
      from: from ? new Date(from) : defaultFrom,
      to: to ? new Date(to) : defaultTo,
    });
  }
}
