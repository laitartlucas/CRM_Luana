import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit } from '../common/decorators/audit.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

/**
 * Qualquer usuário autenticado usa tarefas; o isolamento por papel (atendente
 * só vê as suas) é feito no TasksService.
 */
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@Query() query: ListTasksQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.list(query, user);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.summary(user);
  }

  @Audit('task')
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.create(dto, user);
  }

  @Audit('task')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.update(id, dto, user);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.complete(id, user);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.reopen(id, user);
  }

  @Audit('task')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.remove(id, user);
  }
}
