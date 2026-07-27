import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Audit } from '../common/decorators/audit.decorator';
import { CatalogService } from './catalog.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@UseGuards(RolesGuard)
@Controller('services')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.catalogService.list(includeInactive === 'true');
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Audit('service')
  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.catalogService.create(dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Audit('service')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.catalogService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Audit('service')
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.catalogService.deactivate(id);
  }
}
