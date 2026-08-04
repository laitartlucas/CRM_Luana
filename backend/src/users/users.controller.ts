import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMessageTemplatesDto } from './dto/update-message-templates.dto';
import { CreateCustomMessageTemplateDto, UpdateCustomMessageTemplateDto } from './dto/custom-message-template.dto';

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

  /** Padrões de mensagem do WhatsApp da própria usuária logada (qualquer role autenticada pode ajustar os seus). */
  @Get('me/message-templates')
  getMyMessageTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMessageTemplates(user.id);
  }

  @Put('me/message-templates')
  @Audit('user')
  updateMyMessageTemplates(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMessageTemplatesDto) {
    return this.usersService.updateMessageTemplates(user.id, dto);
  }

  /** Mensagens personalizadas — sem chave fixa, a usuária cria/edita/apaga quantas quiser. */
  @Post('me/message-templates/custom')
  @Audit('user')
  addCustomMessageTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomMessageTemplateDto) {
    return this.usersService.addCustomTemplate(user.id, dto);
  }

  @Patch('me/message-templates/custom/:templateId')
  @Audit('user')
  updateCustomMessageTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateCustomMessageTemplateDto,
  ) {
    return this.usersService.updateCustomTemplate(user.id, templateId, dto);
  }

  @Delete('me/message-templates/custom/:templateId')
  @Audit('user')
  removeCustomMessageTemplate(@CurrentUser() user: AuthenticatedUser, @Param('templateId') templateId: string) {
    return this.usersService.removeCustomTemplate(user.id, templateId);
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
