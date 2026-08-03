import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SuccessStage } from '@prisma/client';

export class ChangeSuccessStageDto {
  @IsEnum(SuccessStage)
  toStage!: SuccessStage;

  @IsOptional()
  @IsString()
  reason?: string;
}
