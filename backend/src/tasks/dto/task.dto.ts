import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o título da tarefa.' })
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  // null limpa o prazo (só faz sentido no PATCH).
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  // Padrão: quem está criando.
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  // Lead ou cliente ao qual a tarefa se refere; null desvincula (PATCH).
  @IsOptional()
  @IsUUID()
  clientId?: string | null;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export const TASK_SCOPES = ['overdue', 'today', 'upcoming', 'nodate', 'done', 'open'] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

export class ListTasksQueryDto {
  @IsOptional()
  @IsIn(TASK_SCOPES)
  scope?: TaskScope;

  /** "me" ou o id de um usuário. Atendentes só enxergam as próprias tarefas, independentemente deste filtro. */
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
