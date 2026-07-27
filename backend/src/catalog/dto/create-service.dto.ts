import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(5)
  durationMinutes!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
