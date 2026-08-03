import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdatePipelineCardDto {
  @IsOptional()
  @IsString()
  nextActionNote?: string;

  @IsOptional()
  @IsDateString()
  nextActionAt?: string;

  @IsOptional()
  @IsNumber()
  proposalValue?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
