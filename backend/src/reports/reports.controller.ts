import { Controller, Get, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PeriodQueryDto } from '../common/dto/period-query.dto';
import { ExportClientsQueryDto, ExportLeadsQueryDto } from './dto/export-query.dto';
import { CsvFile, ReportsService } from './reports.service';

/** Exportações em planilha (CSV). Contêm dados pessoais e de receita: só ADMIN/MANAGER, e cada uma fica no audit log. */
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private send(res: Response, file: CsvFile) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Export-Truncated', String(file.truncated));
    return file.csv;
  }

  @Get('leads.csv')
  async leads(@Query() query: ExportLeadsQueryDto, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.reports.leadsCsv(query, user));
  }

  @Get('clients.csv')
  async clients(@Query() query: ExportClientsQueryDto, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.reports.clientsCsv(query, user));
  }

  @Get('funnel.csv')
  async funnel(@Query() query: PeriodQueryDto, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.reports.funnelCsv(query, user));
  }

  @Get('origins.csv')
  async origins(@Query() query: PeriodQueryDto, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.reports.originsCsv(query, user));
  }
}
