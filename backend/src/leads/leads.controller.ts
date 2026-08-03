import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeadSource } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { AdvanceToPipelineDto } from './dto/advance-to-pipeline.dto';

@UseGuards(RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  list(@Query('search') search?: string, @Query('source') source?: LeadSource) {
    return this.leadsService.list({ search, source });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.leadsService.findById(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.leadsService.getProfile(id);
  }

  @Audit('client')
  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Audit('client')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Audit('client')
  @Post(':id/advance-to-pipeline')
  advanceToPipeline(
    @Param('id') id: string,
    @Body() dto: AdvanceToPipelineDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.advanceToPipeline(id, user?.id, dto.reason);
  }
}
