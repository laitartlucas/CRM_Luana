import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class SubmitIntakeDto {
  @IsOptional()
  @IsString()
  bodyType?: string;

  @IsOptional()
  @IsString()
  colorPalette?: string;

  @IsOptional()
  @IsString()
  predominantStyle?: string;

  @IsOptional()
  @IsNumber()
  averageBudget?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredBrands?: string[];

  @IsOptional()
  @IsString()
  restrictions?: string;
}
