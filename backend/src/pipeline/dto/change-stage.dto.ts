import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PipelineStage } from '@prisma/client';

export class ChangeStageDto {
  @IsEnum(PipelineStage)
  toStage!: PipelineStage;

  // Obrigatório só quando toStage === CALL_SCHEDULED (validado no service,
  // pois depende do valor de outro campo do mesmo DTO).
  @IsOptional()
  @IsDateString()
  callDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
