import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomMessageTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

export class UpdateCustomMessageTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text?: string;
}
