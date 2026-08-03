import { IsOptional, IsString } from 'class-validator';

export class AdvanceToPipelineDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
