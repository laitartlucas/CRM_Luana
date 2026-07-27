import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ScheduleBlockType } from '@prisma/client';

export class CreateBlockDto {
  @IsString()
  professionalId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsEnum(ScheduleBlockType)
  type!: ScheduleBlockType;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
