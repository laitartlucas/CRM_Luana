import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PeriodQueryDto } from '../common/dto/period-query.dto';
import { resolvePeriod } from '../common/utils/period';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PipelineService } from './pipeline.service';
import { ChangeStageDto } from './dto/change-stage.dto';
import { UpdatePipelineCardDto } from './dto/update-pipeline-card.dto';

@UseGuards(RolesGuard)
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('board')
  board() {
    return this.pipelineService.board();
  }

  // Relatórios de funil e receita: só ADMIN/MANAGER (o RolesGuard global aplica).
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('funnel-report')
  funnelReport(@Query() query: PeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { from, to } = resolvePeriod(query, user.timezone);
    return this.pipelineService.funnelReport(from, to);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('origin-report')
  originReport(@Query() query: PeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { from, to } = resolvePeriod(query, user.timezone);
    return this.pipelineService.originReport(from, to);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('metrics')
  metrics(@Query() query: PeriodQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const { from, to } = resolvePeriod(query, user.timezone);
    return this.pipelineService.metrics(from, to);
  }

  @Audit('client')
  @Patch(':id/stage')
  changeStage(
    @Param('id') id: string,
    @Body() dto: ChangeStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pipelineService.changeStage(id, dto, user?.id);
  }

  @Audit('client')
  @Patch(':id')
  updateCard(@Param('id') id: string, @Body() dto: UpdatePipelineCardDto) {
    return this.pipelineService.updateCard(id, dto);
  }
}
