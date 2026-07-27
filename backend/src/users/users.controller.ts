import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get()
  list() {
    return this.usersService.list();
  }

  @Get('professionals')
  listProfessionals() {
    return this.usersService.listProfessionals();
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Roles(Role.ADMIN)
  @Audit('user')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Audit('user')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Audit('user')
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}
