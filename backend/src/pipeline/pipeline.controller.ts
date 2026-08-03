import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
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

  @Get('funnel-report')
  funnelReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.pipelineService.funnelReport(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get('origin-report')
  originReport() {
    return this.pipelineService.originReport();
  }

  @Get('metrics')
  metrics() {
    return this.pipelineService.metrics();
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
